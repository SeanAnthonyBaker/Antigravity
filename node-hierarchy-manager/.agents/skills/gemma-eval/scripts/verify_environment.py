#!/usr/bin/env python3
"""
Pre-flight check script for Gemma evaluation environment.
"""
import sys
import platform

def main():
    print("--- Gemma Eval Pre-Flight Check ---")
    print(f"Python Version: {platform.python_version()}")
    print(f"OS Platform: {platform.platform()}")
    
    try:
        import torch
        cuda_avail = torch.cuda.is_available()
        device_count = torch.cuda.device_count() if cuda_avail else 0
        device_name = torch.cuda.get_device_name(0) if cuda_avail else "CPU"
        print(f"PyTorch: {torch.__version__} | CUDA Available: {cuda_avail} (GPUs: {device_count}, Primary: {device_name})")
    except ImportError:
        print("[WARN] PyTorch is not installed.")

    try:
        import transformers
        print(f"Transformers: {transformers.__version__}")
    except ImportError:
        print("[WARN] Hugging Face Transformers is not installed.")

    print("Pre-flight check completed.")

if __name__ == '__main__':
    main()
