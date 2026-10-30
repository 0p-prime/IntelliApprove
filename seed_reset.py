#!/usr/bin/env python3
"""
IntelliApprove — Single-Step Clean Demo Data Reset Command
Wipes and restores pristine test data across all 15 models, 25 users,
5 workflow templates, applications, documents, and recomputes the
tamper-evident SHA-256 audit ledger from the genesis anchor.
"""
import os
import sys
from pathlib import Path

# Configure utf-8 encoding for standard outputs on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ["PYTHONPATH"] = str(BACKEND_DIR)

from app.core.database import SessionLocal
from app.seed import seed_database, print_row_counts
from app.services.audit_service import AuditService

def main():
    print("\n" + "=" * 65)
    print(" [INTELLIAPPROVE] RESTORING CLEAN DEMO EVALUATION DATASET")
    print("=" * 65)
    
    # 1. Execute full reset and reseed
    print("\n[1/3] Executing complete database wipe and structured reseed...")
    seed_database(reset=True)
    
    # 2. Print row counts
    print("\n[2/3] Verifying table population across all 15 database entities:")
    print_row_counts()
    
    # 3. Verify cryptographic SHA-256 audit hash chain
    print("\n[3/3] Validating Rule #1 Cryptographic Hash Chain Integrity...")
    db = SessionLocal()
    verification = AuditService.verify_chain(db)
    db.close()
    
    if verification.get("is_valid"):
        print(f"  [OK] Audit Chain Status     : {verification.get('status')}")
        print(f"  [OK] Verified Records      : {verification.get('total_records')}")
        print(f"  [OK] Genesis Anchor Block  : {verification.get('genesis_hash')[:16]}...")
        print(f"  [OK] Head Block Hash       : {verification.get('head_hash')[:16]}...")
        print(f"  [OK] Verification Time     : {verification.get('verification_duration_ms')} ms")
    else:
        print(f"  [FAIL] Chain verification error: {verification.get('details')}")
        sys.exit(1)
        
    print("\n" + "=" * 65)
    print("  [SUCCESS] DEMO ENVIRONMENT RESTORED TO PRISTINE STATE!")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    main()
