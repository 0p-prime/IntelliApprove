"""
Seed AICTE Approval Process Handbook (APH) Regulatory Norm Rules and Academic Programs.
"""
import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.models.entities import (
    ComplianceNormRule,
    AcademicProgram,
    Application,
    Institution
)
from app.services.compliance_service import ComplianceService

NORM_RULES = [
    {
        "rule_code": "FSR_NORM",
        "name": "Faculty-to-Student Ratio (FSR)",
        "category": "FACULTY",
        "description": "Prescribed statutory ratio of full-time faculty to enrolled students for technical programs (1:15 standard for UG Engineering, allowable margin 1:20).",
        "standard_value": 15.0,
        "threshold_margin_percent": 0.0,
        "unit": "ratio",
        "severity": "CRITICAL",
        "is_active": True
    },
    {
        "rule_code": "LAND_ACRES",
        "name": "Campus Contiguous Land Requirement",
        "category": "INFRASTRUCTURE",
        "description": "Minimum contiguous land area in acres required for operating the technical campus as specified in APH Chapter I/II.",
        "standard_value": 7.5,
        "threshold_margin_percent": 5.0,
        "unit": "acres",
        "severity": "CRITICAL",
        "is_active": True
    },
    {
        "rule_code": "BUILTUP_AREA",
        "name": "Instructional Built-Up Space",
        "category": "INFRASTRUCTURE",
        "description": "Prescribed instructional, administrative, and amenities carpet area per enrolled student (10 sqm per student minimum).",
        "standard_value": 10.0,
        "threshold_margin_percent": 5.0,
        "unit": "sqm/student",
        "severity": "MAJOR",
        "is_active": True
    },
    {
        "rule_code": "COMPUTER_RATIO",
        "name": "Computing Terminals & Digital Labs",
        "category": "INFRASTRUCTURE",
        "description": "Prescribed terminal-to-student ratio (minimum 1 PC per 4 students, ratio >= 0.25) connected to broadband internet.",
        "standard_value": 0.25,
        "threshold_margin_percent": 0.0,
        "unit": "PC/student",
        "severity": "MAJOR",
        "is_active": True
    },
    {
        "rule_code": "ANTI_RAGGING",
        "name": "Statutory Anti-Ragging Committee & Squad",
        "category": "GOVERNANCE",
        "description": "Mandatory constitution of Anti-Ragging Committee and Squad per AICTE Regulations 2009 (F.No.37-3/Legal/AICTE/2009).",
        "standard_value": 1.0,
        "threshold_margin_percent": 0.0,
        "unit": "status",
        "severity": "CRITICAL",
        "is_active": True
    },
    {
        "rule_code": "ICC_COMMITTEE",
        "name": "Internal Complaints Committee (POSH Act)",
        "category": "GOVERNANCE",
        "description": "Statutory gender sensitization cell and Internal Complaints Committee constituted under the POSH Act 2013.",
        "standard_value": 1.0,
        "threshold_margin_percent": 0.0,
        "unit": "status",
        "severity": "CRITICAL",
        "is_active": True
    },
    {
        "rule_code": "GRIEVANCE_COMMITTEE",
        "name": "Student Grievance Redressal Committee (SGRC)",
        "category": "GOVERNANCE",
        "description": "Mandatory registration of SGRC on AICTE Centralized Grievance Redressal Portal and appointment of Ombudsperson.",
        "standard_value": 1.0,
        "threshold_margin_percent": 0.0,
        "unit": "status",
        "severity": "MAJOR",
        "is_active": True
    },
    {
        "rule_code": "BARRIER_FREE",
        "name": "Barrier-Free Divyangjan Accessibility",
        "category": "INFRASTRUCTURE",
        "description": "Universal physical accessibility conforming to RPwD Act 2016: certified ramps, Braille elevators, and disabled-friendly restrooms.",
        "standard_value": 1.0,
        "threshold_margin_percent": 0.0,
        "unit": "status",
        "severity": "MAJOR",
        "is_active": True
    },
    {
        "rule_code": "CADRE_RATIO",
        "name": "Faculty Cadre Distribution (1:2:6)",
        "category": "FACULTY",
        "description": "Cadre ratio compliance among Professor, Associate Professor, and Assistant Professor per department cadre guidelines.",
        "standard_value": 1.0,
        "threshold_margin_percent": 10.0,
        "unit": "ratio",
        "severity": "MINOR",
        "is_active": True
    }
]

def seed_aph_norms():
    db = SessionLocal()
    try:
        print("[Seed APH] Seeding 9 AICTE Approval Process Handbook (APH) Norm Rules...")
        for r_data in NORM_RULES:
            existing = db.query(ComplianceNormRule).filter(ComplianceNormRule.rule_code == r_data["rule_code"]).first()
            if not existing:
                rule = ComplianceNormRule(**r_data)
                db.add(rule)
            else:
                for k, v in r_data.items():
                    setattr(existing, k, v)
        db.commit()

        # Seed Academic Programs for applications
        applications = db.query(Application).all()
        print(f"[Seed APH] Checking academic programs for {len(applications)} applications...")
        
        seeded_programs = 0
        for app in applications:
            existing_progs = db.query(AcademicProgram).filter(AcademicProgram.application_id == app.id).count()
            if existing_progs == 0:
                # Seed realistic department programs
                # Application 1: DITM Delhi - Top tier, compliant
                # Application 4: Slight FSR deficiency
                # Application 7: Builtup area deficiency
                is_top = (app.id % 5 == 1)
                is_fsr_deficient = (app.id % 7 == 0)
                
                prog_configs = [
                    {
                        "program_name": "B.Tech Computer Science & Engineering",
                        "level": "Undergraduate",
                        "approved_intake_prev_year": 120,
                        "requested_intake": 120,
                        "faculty_count": 16 if not is_fsr_deficient else 8,
                        "total_enrolled": 480,
                        "cadre_ratio": "1:2:6"
                    },
                    {
                        "program_name": "B.Tech Electronics & Communication",
                        "level": "Undergraduate",
                        "approved_intake_prev_year": 60,
                        "requested_intake": 60,
                        "faculty_count": 8 if not is_fsr_deficient else 4,
                        "total_enrolled": 240,
                        "cadre_ratio": "1:2:5"
                    },
                    {
                        "program_name": "B.Tech Mechanical Engineering",
                        "level": "Undergraduate",
                        "approved_intake_prev_year": 60,
                        "requested_intake": 60,
                        "faculty_count": 8 if not is_fsr_deficient else 3,
                        "total_enrolled": 240,
                        "cadre_ratio": "1:2:6"
                    },
                    {
                        "program_name": "Master of Business Administration (MBA)",
                        "level": "Postgraduate",
                        "approved_intake_prev_year": 60,
                        "requested_intake": 60,
                        "faculty_count": 6 if not is_fsr_deficient else 2,
                        "total_enrolled": 120,
                        "cadre_ratio": "1:2:4"
                    }
                ]

                for p in prog_configs:
                    program = AcademicProgram(
                        application_id=app.id,
                        **p
                    )
                    db.add(program)
                    seeded_programs += 1

        db.commit()
        print(f"[Seed APH] Successfully seeded {seeded_programs} academic program records.")

        # Run automated compliance evaluation for all applications to populate scores & deficiencies
        print("[Seed APH] Evaluating initial compliance scores across applications...")
        eval_count = 0
        for app in applications:
            try:
                ComplianceService.run_compliance_evaluation(db=db, application_id=app.id)
                eval_count += 1
            except Exception as eval_err:
                print(f"[Seed APH] Warning on app #{app.id}: {eval_err}")

        print(f"[Seed APH] Successfully evaluated compliance for {eval_count} applications.")

    except Exception as e:
        db.rollback()
        print(f"[Seed APH] Error: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_aph_norms()

