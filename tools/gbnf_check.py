#!/usr/bin/env python3
# gbnf_check.py -- reads Lantern's block grammars with llama.cpp's own grammar parser, and runs blocks through them
# (1.24.31). Lantern sends a grammar (AI_ACTIONS' grammarFor) when it asks a model for only a block; llama-server
# refuses a request whose grammar it cannot parse, and a grammar that parses can still hold out a right block. This
# loads libllama from a llama.cpp release (the kit's engine) with a vocabulary-only model file, so no model weights
# are needed:
#
#   python3 tools/gbnf_check.py --lib <llama.cpp release folder>/libllama.so --vocab ggml-vocab-qwen2.gguf cases.json
#
# cases.json: [{"name": ..., "grammar": "<GBNF>", "samples": [{"text": "MAKE STATION: ...\nEND", "want": true}, ...]}]
# For each sample, each token of the text is offered to the grammar sampler alone; a token it turns to -inf is where
# the grammar holds the text out. At the end, the end of the text must be allowed (an end-of-generation token).
# Prints one line per case and sample, and "ALL GRAMMARS AGREE" when every sample does what it wants.
# ggml-vocab-qwen2.gguf is in llama.cpp's repository (models/); the Qwen3.5 models the kit runs share Qwen2's tokens
# closely enough for this: the grammar is matched on the text of each token, not its number.
import ctypes, json, math, sys, argparse

ap = argparse.ArgumentParser()
ap.add_argument("--lib", required=True)
ap.add_argument("--vocab", required=True)
ap.add_argument("cases")
ap.add_argument("--out", help="write the results here as JSON")
a = ap.parse_args()

lib = ctypes.CDLL(a.lib)

class ModelParams(ctypes.Structure):   # llama.h, b11435: struct llama_model_params (80 bytes)
    _fields_ = [("devices", ctypes.c_void_p), ("tensor_buft_overrides", ctypes.c_void_p), ("n_gpu_layers", ctypes.c_int32),
                ("split_mode", ctypes.c_int32), ("load_mode", ctypes.c_int32), ("lazy_mode", ctypes.c_int32), ("main_gpu", ctypes.c_int32),
                ("tensor_split", ctypes.c_void_p), ("progress_callback", ctypes.c_void_p), ("progress_callback_user_data", ctypes.c_void_p),
                ("kv_overrides", ctypes.c_void_p), ("vocab_only", ctypes.c_bool), ("check_tensors", ctypes.c_bool), ("use_extra_bufts", ctypes.c_bool),
                ("no_host", ctypes.c_bool), ("no_alloc", ctypes.c_bool), ("load_mtp", ctypes.c_bool)]

class TokenData(ctypes.Structure):
    _fields_ = [("id", ctypes.c_int32), ("logit", ctypes.c_float), ("p", ctypes.c_float)]

class TokenDataArray(ctypes.Structure):
    _fields_ = [("data", ctypes.POINTER(TokenData)), ("size", ctypes.c_size_t), ("selected", ctypes.c_int64), ("sorted", ctypes.c_bool)]

lib.llama_backend_init.restype = None
lib.llama_model_default_params.restype = ModelParams
lib.llama_model_load_from_file.argtypes = [ctypes.c_char_p, ModelParams]
lib.llama_model_load_from_file.restype = ctypes.c_void_p
lib.llama_model_get_vocab.argtypes = [ctypes.c_void_p]
lib.llama_model_get_vocab.restype = ctypes.c_void_p
lib.llama_tokenize.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int32, ctypes.POINTER(ctypes.c_int32), ctypes.c_int32, ctypes.c_bool, ctypes.c_bool]
lib.llama_tokenize.restype = ctypes.c_int32
lib.llama_sampler_init_grammar.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p]
lib.llama_sampler_init_grammar.restype = ctypes.c_void_p
lib.llama_sampler_apply.argtypes = [ctypes.c_void_p, ctypes.POINTER(TokenDataArray)]
lib.llama_sampler_apply.restype = None
lib.llama_sampler_accept.argtypes = [ctypes.c_void_p, ctypes.c_int32]
lib.llama_sampler_accept.restype = None
lib.llama_sampler_free.argtypes = [ctypes.c_void_p]
lib.llama_sampler_free.restype = None
lib.llama_vocab_eos.argtypes = [ctypes.c_void_p]
lib.llama_vocab_eos.restype = ctypes.c_int32
lib.llama_vocab_eot.argtypes = [ctypes.c_void_p]
lib.llama_vocab_eot.restype = ctypes.c_int32

lib.llama_backend_init()
mp = lib.llama_model_default_params()
mp.vocab_only = True
model = lib.llama_model_load_from_file(a.vocab.encode(), mp)
if not model:
    sys.exit("could not load " + a.vocab)
vocab = lib.llama_model_get_vocab(model)
EOG = [t for t in (lib.llama_vocab_eot(vocab), lib.llama_vocab_eos(vocab)) if t >= 0]

def tokens(text):
    b = text.encode("utf-8")
    buf = (ctypes.c_int32 * (len(b) + 16))()
    n = lib.llama_tokenize(vocab, b, len(b), buf, len(b) + 16, False, False)
    if n < 0:
        sys.exit("tokenize failed")
    return list(buf[:n])

def allowed(smpl, tok):
    arr = (TokenData * 1)(TokenData(tok, 0.0, 0.0))
    ta = TokenDataArray(arr, 1, -1, False)
    lib.llama_sampler_apply(smpl, ctypes.byref(ta))
    return not math.isinf(ta.data[0].logit)

cases = json.load(open(a.cases, encoding="utf-8"))
results, bad = [], 0
for c in cases:
    g = c["grammar"].encode("utf-8")
    smpl = lib.llama_sampler_init_grammar(vocab, g, b"root")
    r = {"name": c["name"], "parsed": bool(smpl), "samples": []}
    if not smpl:
        bad += 1
        print("%-34s GRAMMAR NOT PARSED" % c["name"])
        results.append(r)
        continue
    print("%-34s parsed" % c["name"])
    lib.llama_sampler_free(smpl)
    for s in c.get("samples", []):
        smpl = lib.llama_sampler_init_grammar(vocab, g, b"root")
        toks, at, ok = tokens(s["text"]), None, True
        for i, t in enumerate(toks):
            if not allowed(smpl, t):
                ok, at = False, i
                break
            lib.llama_sampler_accept(smpl, t)
        ends = ok and any(allowed(smpl, e) for e in EOG)
        got = ok and ends
        lib.llama_sampler_free(smpl)
        agree = got == s["want"]
        if not agree:
            bad += 1
        r["samples"].append({"text": s["text"], "want": s["want"], "accepted": got, "heldAtToken": at, "ends": ends, "agree": agree})
        print("   %s  want %-5s got %-5s%s  %s" % ("ok " if agree else "BAD", s["want"], got, (" (held at token %d)" % at) if at is not None else (" (cannot end)" if ok and not ends else ""),
                                                 s["text"].replace("\n", " | ")[:90]))
    results.append(r)
if a.out:
    json.dump(results, open(a.out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("ALL GRAMMARS AGREE" if not bad else "%d DISAGREE" % bad)
sys.exit(1 if bad else 0)
