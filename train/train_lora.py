"""train_lora.py -- fit a small model to Lantern with a LoRA (CLAUDE.md, "The combined system, and then a model
trained to it"; Adam, 2026-11-24).

    python train/train_lora.py --model Qwen/Qwen3.5-0.8B --data train/data/lantern_short_train.jsonl --out train/out/0.8b

Reads the examples train/build_data.js wrote (the messages exactly as Lantern sent them, the reply a model wrote that
Lantern passed) and trains a LoRA adapter on the model's replies only: the prompt is never a target, and in an example
of two rounds only the last reply is (the first was the slip Lantern sent back). Each example is laid out the way the
model's server lays out a request (the model's own chat template, thinking off, as Lantern asks: enable_thinking
false), so what it learns is what it will be asked.

A share of the questions (--hold, by question: all the number variants of a question go the same way) is kept out of
training and its loss reported, so over-fitting shows. The bench's set B is never in the data at all; it is the test.
Writes <out>/adapter (the LoRA and the tokenizer) and <out>/train_log.json.
Needs: torch (with CUDA for a real run), transformers (new enough for the model), peft, safetensors.
"""
import argparse, json, math, os, random, sys, time


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--model", required=True, help="a Hugging Face id or a local folder of the base model")
    ap.add_argument("--data", required=True, help="the _train.jsonl that build_data.js wrote")
    ap.add_argument("--out", required=True)
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--r", type=int, default=16)
    ap.add_argument("--alpha", type=int, default=32)
    ap.add_argument("--dropout", type=float, default=0.05)
    ap.add_argument("--max-len", type=int, default=4096, help="examples longer than this (prompt and reply) are left out, and counted")
    ap.add_argument("--batch", type=int, default=1)
    ap.add_argument("--accum", type=int, default=8)
    ap.add_argument("--hold", type=float, default=0.08, help="share of questions kept out to measure over-fitting")
    ap.add_argument("--seed", type=int, default=1238)
    ap.add_argument("--qlora", action="store_true", help="hold the base model in 4-bit (bitsandbytes): for a 9B in 16 GB")
    ap.add_argument("--cpu", action="store_true", help="no GPU: for a test with a tiny model only")
    ap.add_argument("--max-steps", type=int, default=0, help="stop after this many optimiser steps (a test)")
    a = ap.parse_args()

    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import LoraConfig, get_peft_model

    random.seed(a.seed); torch.manual_seed(a.seed)
    os.makedirs(a.out, exist_ok=True)
    dev = "cpu" if a.cpu or not torch.cuda.is_available() else "cuda"
    if dev == "cpu" and not a.cpu:
        print("No CUDA GPU was found. A real run needs one (the NVIDIA card); add --cpu to test with a tiny model.")
        sys.exit(2)
    bf16 = dev == "cuda" and torch.cuda.is_bf16_supported()
    dtype = torch.bfloat16 if bf16 else (torch.float16 if dev == "cuda" else torch.float32)

    tok = AutoTokenizer.from_pretrained(a.model, trust_remote_code=False)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    end = "<|im_end|>" if "<|im_end|>" in tok.get_vocab() else tok.eos_token

    def render(messages):
        """the prompt as the server lays it out, and the reply the model is to write after it"""
        *ctx, last = messages
        if last["role"] != "assistant":
            raise ValueError("the last message is not the model's")
        kw = dict(tokenize=False, add_generation_prompt=True)
        try:
            prompt = tok.apply_chat_template(ctx, enable_thinking=False, **kw)
        except TypeError:
            prompt = tok.apply_chat_template(ctx, **kw)
        return prompt, last["content"] + end

    rows = [json.loads(l) for l in open(a.data, encoding="utf-8") if l.strip()]
    # keep out a share of questions, by question (a question and its number variants together)
    qid = lambda r: r["meta"].get("variantOf") or r["meta"]["id"]
    ids = sorted(set(qid(r) for r in rows))
    random.shuffle(ids)
    held = set(ids[: max(1, int(len(ids) * a.hold))]) if a.hold > 0 else set()
    train, dev_rows, too_long = [], [], 0
    for r in rows:
        prompt, reply = render(r["messages"])
        p_ids = tok(prompt, add_special_tokens=False)["input_ids"]
        r_ids = tok(reply, add_special_tokens=False)["input_ids"]
        if len(p_ids) + len(r_ids) > a.max_len:
            too_long += 1
            continue
        ex = {"input_ids": p_ids + r_ids, "labels": [-100] * len(p_ids) + r_ids}
        (dev_rows if qid(r) in held else train).append(ex)
    print("examples: %d to train on, %d kept out (%d questions), %d longer than %d tokens left out"
          % (len(train), len(dev_rows), len(held), too_long, a.max_len))
    if not train:
        print("nothing to train on"); sys.exit(1)

    load = dict(dtype=dtype)
    if a.qlora:
        from transformers import BitsAndBytesConfig
        load["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=dtype)
        load["device_map"] = {"": 0}
    model = AutoModelForCausalLM.from_pretrained(a.model, **load)
    if a.qlora:
        from peft import prepare_model_for_kbit_training
        model = prepare_model_for_kbit_training(model)
    else:
        model.to(dev)
    model.config.use_cache = False
    if dev == "cuda":
        model.gradient_checkpointing_enable()
        model.enable_input_require_grads()
    # the attention and MLP projections of the language model (not a vision tower's); "all-linear" for any other layout
    names = {n.split(".")[-1] for n, m in model.named_modules() if isinstance(m, torch.nn.Linear) and "vision" not in n and "visual" not in n}
    want = [t for t in ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"] if t in names]
    cfg = LoraConfig(r=a.r, lora_alpha=a.alpha, lora_dropout=a.dropout, bias="none", task_type="CAUSAL_LM",
                     target_modules=want or "all-linear")
    model = get_peft_model(model, cfg)
    model.print_trainable_parameters()

    def batches(data, shuffle):
        order = list(range(len(data)))
        if shuffle:
            random.shuffle(order)
        for i in range(0, len(order), a.batch):
            chunk = [data[j] for j in order[i:i + a.batch]]
            n = max(len(x["input_ids"]) for x in chunk)
            ids = [x["input_ids"] + [tok.pad_token_id] * (n - len(x["input_ids"])) for x in chunk]
            lab = [x["labels"] + [-100] * (n - len(x["labels"])) for x in chunk]
            att = [[1] * len(x["input_ids"]) + [0] * (n - len(x["input_ids"])) for x in chunk]
            yield (torch.tensor(ids, device=dev), torch.tensor(lab, device=dev), torch.tensor(att, device=dev))

    def evaluate():
        if not dev_rows:
            return None
        model.eval(); tot = 0.0; cnt = 0
        with torch.no_grad():
            for ids, lab, att in batches(dev_rows, False):
                out = model(input_ids=ids, attention_mask=att, labels=lab)
                k = int((lab != -100).sum()); tot += float(out.loss) * k; cnt += k
        model.train()
        return tot / max(1, cnt)

    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=a.lr, weight_decay=0.0)
    steps_per_epoch = math.ceil(len(train) / a.batch / a.accum)
    total = a.max_steps or max(1, int(steps_per_epoch * a.epochs))
    warm = max(1, total // 20)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / warm) * max(0.0, 0.5 * (1 + math.cos(math.pi * min(1.0, s / total)))))
    log = {"model": a.model, "data": a.data, "examples": len(train), "kept_out": len(dev_rows), "steps": total, "lr": a.lr, "r": a.r, "alpha": a.alpha,
           "epochs": a.epochs, "loss": [], "dev_loss": []}
    d0 = evaluate()
    log["dev_loss"].append([0, d0])
    print("before training: kept-out loss %s" % (round(d0, 4) if d0 is not None else "-"))
    model.train(); step = 0; micro = 0; t0 = time.time(); run = 0.0; seen = 0
    while step < total:
        for ids, lab, att in batches(train, True):
            out = model(input_ids=ids, attention_mask=att, labels=lab)
            (out.loss / a.accum).backward()
            run += out.loss.item(); seen += 1; micro += 1
            if micro % a.accum:
                continue
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); opt.zero_grad(); step += 1
            if step % 10 == 0 or step == total:
                log["loss"].append([step, run / seen]); print("step %d/%d  loss %.4f  %.0fs" % (step, total, run / seen, time.time() - t0)); run = 0.0; seen = 0
            if step % max(1, total // 4) == 0 or step == total:
                dl = evaluate(); log["dev_loss"].append([step, dl])
                print("  kept-out loss %s" % (round(dl, 4) if dl is not None else "-"))
            if step >= total:
                break
    model.save_pretrained(os.path.join(a.out, "adapter"))
    tok.save_pretrained(os.path.join(a.out, "adapter"))
    log["seconds"] = round(time.time() - t0)
    json.dump(log, open(os.path.join(a.out, "train_log.json"), "w"), indent=1)
    print("adapter written to %s (%d s)" % (os.path.join(a.out, "adapter"), log["seconds"]))


if __name__ == "__main__":
    main()
