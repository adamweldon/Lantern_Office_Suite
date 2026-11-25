"""merge_to_gguf.py -- the trained LoRA put into the model, and the model made a .gguf the stick's engine runs.

    python train/merge_to_gguf.py --model Qwen/Qwen3.5-0.8B --adapter train/out/0.8b/adapter --out train/out/0.8b \
        --llama <llama.cpp source folder> [--quantize <llama-quantize program>] [--name Qwen3.5-0.8B-Lantern]

1. The base model is loaded on the CPU in bf16, the adapter merged in, and the whole saved (<out>/merged).
2. llama.cpp's own converter (convert_hf_to_gguf.py, from the same build as the kit's engine, so the engine reads what
   it writes) makes <name>-BF16.gguf.
3. With llama-quantize (in the kit's engine folder) it becomes <name>-Q4_K_M.gguf, the same size of number the stick's
   own model uses, so the bench compares the two like for like; without it, Q8_0 straight from the converter, and the
   summary says so.
The model's vision part (mmproj-...gguf) is not trained and stays as it is.
"""
import argparse, os, subprocess, sys


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--model", required=True)
    ap.add_argument("--adapter", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--llama", required=True, help="the llama.cpp source folder (holds convert_hf_to_gguf.py)")
    ap.add_argument("--quantize", default="", help="llama-quantize(.exe); empty: Q8_0 from the converter")
    ap.add_argument("--name", default="")
    a = ap.parse_args()
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel

    name = a.name or (os.path.basename(a.model.rstrip("/\\")) + "-Lantern")
    merged = os.path.join(a.out, "merged")
    print("merging the adapter into %s ..." % a.model)
    base = AutoModelForCausalLM.from_pretrained(a.model, torch_dtype=torch.bfloat16)
    model = PeftModel.from_pretrained(base, a.adapter).merge_and_unload()
    model.save_pretrained(merged, safe_serialization=True)
    AutoTokenizer.from_pretrained(a.adapter).save_pretrained(merged)
    conv = os.path.join(a.llama, "convert_hf_to_gguf.py")
    if not os.path.exists(conv):
        print("no convert_hf_to_gguf.py in %s" % a.llama); sys.exit(1)
    env = dict(os.environ, PYTHONPATH=os.path.join(a.llama, "gguf-py") + os.pathsep + os.environ.get("PYTHONPATH", ""))
    q = a.quantize if a.quantize and os.path.exists(a.quantize) else ""
    first = os.path.join(a.out, name + ("-BF16.gguf" if q else "-Q8_0.gguf"))
    print("converting with llama.cpp's converter ...")
    # (--no-mtp: Qwen3.5's multi-token-prediction layers are not trained with the rest, and the engine needs them only
    # to guess ahead; a model without them answers the same)
    subprocess.run([sys.executable, conv, merged, "--outtype", "bf16" if q else "q8_0", "--no-mtp", "--outfile", first], check=True, env=env)
    final = first
    if q:
        final = os.path.join(a.out, name + "-Q4_K_M.gguf")
        print("quantizing to Q4_K_M ...")
        subprocess.run([q, first, final, "Q4_K_M"], check=True)
    print("made %s (%.0f MB)" % (final, os.path.getsize(final) / 1e6))


if __name__ == "__main__":
    main()
