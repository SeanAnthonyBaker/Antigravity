---
name: gemma-eval
description: >-
  Use this skill when the user asks to evaluate, benchmark, fine-tune, or test
  Gemma models (e.g., Gemma 2B, 7B, 9B, 27B), run automated model evaluations,
  compute perplexity/loss metrics, or validate inference prompt templates.
---

# Gemma Model Evaluation & Benchmarking Runbook

This skill provides step-by-step procedures to run automated evaluations, prompt validation, and benchmark test suites against Gemma model checkpoints.

## 1. Environment & Pre-Flight Check

Before initiating benchmark evaluations, ensure the target GPU environment and dependencies (Transformers, PyTorch, Accelerate, Datasets) are initialized.

- Execute the pre-flight verification script:
  [verify_environment.py](./scripts/verify_environment.py)
- Confirm model weights are accessible either locally or via Hugging Face cache.

## 2. Running Automated Evaluation

Execute the evaluation runner specifying the model checkpoint and benchmark dataset:

```bash
python .agents/skills/gemma-eval/scripts/evaluate_model.py \
    --model-id "google/gemma-2-9b-it" \
    --benchmark "mmlu-pro" \
    --batch-size 4 \
    --output-dir "./eval_results"
```

## 3. Metric Inspection & Validation

Analyze the evaluation outputs stored in `./eval_results/metrics.json`:
- **Perplexity / Cross-Entropy Loss**: Baseline validation across domain datasets.
- **Accuracy / F1**: Standardized benchmark scores.
- **Safety / Alignment Checks**: Evaluation against red-teaming probe datasets.

For detailed metric thresholds and scoring criteria, refer to:
[metrics_reference.md](./references/metrics_reference.md)

## 4. Verification & Reporting

1. Verify that `metrics.json` and `eval_summary.md` are generated in `./eval_results/`.
2. Inspect log output for out-of-memory (OOM) or quantization fallback warnings.
3. Generate structured evaluation artifacts comparing results to baseline scores.
