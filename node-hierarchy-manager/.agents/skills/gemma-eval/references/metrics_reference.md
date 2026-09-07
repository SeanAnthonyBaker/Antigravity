# Gemma Evaluation Metrics & Thresholds Reference

## Core Evaluation Benchmarks

| Benchmark | Target Metric | Recommended Gemma 2 (9B-IT) Baseline | Passing Threshold |
| :--- | :--- | :--- | :--- |
| **MMLU / MMLU-Pro** | 5-shot Accuracy | ~68.0% | &ge; 65.0% |
| **GSM8K** | Exact Match (8-shot) | ~80.0% | &ge; 75.0% |
| **HumanEval** | Pass@1 (Python) | ~50.0% | &ge; 45.0% |
| **Perplexity (WikiText-2)** | Word Perplexity | ~7.2 | &le; 8.5 |

## Diagnostic Guidance
- **Degraded Perplexity**: If perplexity spikes by >15% over baseline, check context truncation, system prompt tokenization, or quantization calibration.
- **Repetition Anomalies**: If generation enters repetitive loops, adjust `repetition_penalty` (1.05 - 1.15) and verify BOS/EOS token mappings.
