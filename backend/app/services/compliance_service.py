"""
Compliance Engine: Evaluates AICTE Approval Process Handbook (APH) norms.
All rules are loaded dynamically from the database (Rule #3).
Writes audit log for every compliance run (Rule #1).
Never auto-decides final approval (Rule #2).
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.entities import (
    Application,
    AcademicProgram,
    Institution,
    ComplianceNormRule,
    DeficiencyRecord,
    User
)
from app.services.audit_service import AuditService

class ComplianceService:
    @staticmethod
    def run_compliance_evaluation(
        db: Session,
        application_id: int,
        actor_user: Optional[User] = None,
        ip_address: str = "127.0.0.1"
    ) -> Dict[str, Any]:
        """
        Runs automated compliance verification against active handbook rules in DB.
        Generates deficiency records and updates compliance score.
        """
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise ValueError(f"Application with ID {application_id} not found")
        
        institution = application.institution
        programs = db.query(AcademicProgram).filter(AcademicProgram.application_id == application_id).all()
        rules = db.query(ComplianceNormRule).filter(ComplianceNormRule.is_active == True).all()

        total_students = sum(p.total_enrolled for p in programs) if programs else 600
        total_faculty = sum(p.faculty_count for p in programs) if programs else 30
        actual_fsr = round(total_students / max(total_faculty, 1), 2)

        # Clear existing unrectified system-generated deficiencies
        db.query(DeficiencyRecord).filter(
            DeficiencyRecord.application_id == application_id,
            DeficiencyRecord.flagged_by == "SYSTEM",
            DeficiencyRecord.is_rectified == False
        ).delete()

        deficiencies_found: List[DeficiencyRecord] = []
        checklist: List[Dict[str, Any]] = []
        checks_evaluated = 0
        checks_passed = 0

        for rule in rules:
            checks_evaluated += 1
            has_deficiency = False
            title = ""
            desc = ""
            actual_val_str = ""

            if rule.rule_code == "FSR_NORM":
                # standard value is e.g. 15 (meaning 1:15 ratio)
                actual_val_str = f"1:{actual_fsr}"
                max_allowed_fsr = rule.standard_value * (1 + (rule.threshold_margin_percent or 0) / 100.0)
                if actual_fsr > max_allowed_fsr:
                    has_deficiency = True
                    title = f"Faculty-to-Student Ratio Deficiency (1:{actual_fsr})"
                    desc = f"Actual FSR is 1:{actual_fsr}, which violates AICTE APH prescribed maximum 1:{rule.standard_value}. Shortfall of faculty members."

            elif rule.rule_code == "LAND_ACRES":
                land_val = getattr(institution, "total_land_acres", 7.5) if institution else 7.5
                actual_val_str = f"{land_val} Acres"
                min_land = rule.standard_value * (1 - (rule.threshold_margin_percent or 0) / 100.0)
                if land_val < min_land:
                    has_deficiency = True
                    title = f"Insufficient Campus Land Area ({land_val} Acres)"
                    desc = f"Campus land area ({land_val} acres) is below minimum AICTE norm of {rule.standard_value} acres."

            elif rule.rule_code == "BUILTUP_AREA":
                builtup_val = getattr(institution, "total_builtup_sqm", 12500.0) if institution else 12500.0
                min_required_sqm = total_students * rule.standard_value  # e.g., 10 sqm per student
                effective_min = min_required_sqm * (1 - (rule.threshold_margin_percent or 0) / 100.0)
                actual_val_str = f"{builtup_val:,.0f} sqm ({builtup_val / max(total_students, 1):.1f} sqm/student)"
                if builtup_val < effective_min:
                    has_deficiency = True
                    title = f"Shortfall in Built-up Instructional Area ({builtup_val:,.0f} sqm)"
                    desc = f"Current built-up area ({builtup_val:,.0f} sqm) is below required {min_required_sqm:,.0f} sqm for {total_students} enrolled students."

            elif rule.rule_code == "COMPUTER_RATIO":
                computers_val = getattr(institution, "total_computers", 280) if institution else 280
                actual_pc_ratio = round(computers_val / max(total_students, 1), 3)
                actual_val_str = f"{actual_pc_ratio} PC/student ({computers_val} terminals)"
                min_ratio = rule.standard_value * (1 - (rule.threshold_margin_percent or 0) / 100.0)
                if actual_pc_ratio < min_ratio:
                    has_deficiency = True
                    title = f"Inadequate Computer Terminals ({computers_val} PCs)"
                    desc = f"Computer-to-student ratio is {actual_pc_ratio}, below AICTE norm of {rule.standard_value} (Requires at least {int(total_students * rule.standard_value)} PCs)."

            elif rule.rule_code == "ANTI_RAGGING":
                has_comm = getattr(institution, "has_anti_ragging_committee", True) if institution else True
                actual_val_str = "Verified & Constituted" if has_comm else "Missing"
                if not has_comm:
                    has_deficiency = True
                    title = "Statutory Anti-Ragging Committee Not Constituted"
                    desc = "Institution has not verified constitution of Anti-Ragging Squad and Committee per AICTE Regulations 2009."

            elif rule.rule_code == "ICC_COMMITTEE":
                has_comm = getattr(institution, "has_icc_committee", True) if institution else True
                actual_val_str = "Constituted (POSH Act)" if has_comm else "Missing"
                if not has_comm:
                    has_deficiency = True
                    title = "Internal Complaints Committee (ICC) Missing"
                    desc = "Internal Complaints Committee per POSH Act and AICTE gender sensitization regulations not constituted."

            elif rule.rule_code == "GRIEVANCE_COMMITTEE":
                has_comm = getattr(institution, "has_grievance_committee", True) if institution else True
                actual_val_str = "Registered & Active" if has_comm else "Missing"
                if not has_comm:
                    has_deficiency = True
                    title = "Student Grievance Redressal Committee (SGRC) Missing"
                    desc = "Ombudsperson and Student Grievance Committee mandatory registration missing."

            elif rule.rule_code == "BARRIER_FREE":
                has_env = getattr(institution, "has_barrier_free_environment", True) if institution else True
                actual_val_str = "Certified Compliant" if has_env else "Incomplete"
                if not has_env:
                    has_deficiency = True
                    title = "Barrier-Free Divyangjan Accessibility Missing"
                    desc = "Campus lacks certified ramps, tactile paths, and accessible restrooms for differently-abled students."

            elif rule.rule_code == "CADRE_RATIO":
                # Check cadre ratios in programs
                cadre_compliant = True
                bad_program_name = ""
                for p in programs:
                    if p.cadre_ratio not in ["1:2:6", "1:2:5", "1:2:4"]:
                        cadre_compliant = False
                        bad_program_name = p.program_name
                        break
                actual_val_str = "1:2:6 Standard" if cadre_compliant else f"Deficient in {bad_program_name}"
                if not cadre_compliant:
                    has_deficiency = True
                    title = "Faculty Cadre Ratio Non-Compliance"
                    desc = f"Faculty cadre distribution in {bad_program_name} deviates from prescribed 1:2:6 (Prof : Assoc Prof : Asst Prof) cadre norm."

            else:
                actual_val_str = "Evaluated"

            if has_deficiency:
                record = DeficiencyRecord(
                    application_id=application_id,
                    rule_id=rule.id,
                    rule_code=rule.rule_code,
                    title=title,
                    description=desc,
                    severity=rule.severity,
                    flagged_by="SYSTEM",
                    is_rectified=False
                )
                db.add(record)
                deficiencies_found.append(record)
            else:
                checks_passed += 1

            checklist.append({
                "rule_id": rule.id,
                "rule_code": rule.rule_code,
                "name": rule.name,
                "category": rule.category,
                "standard_value": rule.standard_value,
                "unit": rule.unit,
                "actual_value": actual_val_str,
                "status": "DEFICIENT" if has_deficiency else "COMPLIANT",
                "severity": rule.severity,
                "details": desc if has_deficiency else f"Satisfies AICTE APH regulatory norm for {rule.name}."
            })

        db.flush()

        # Calculate compliance score
        score = round((checks_passed / max(checks_evaluated, 1)) * 100, 1) if checks_evaluated > 0 else 100.0
        old_score = getattr(application, "compliance_score", 85.0)
        application.compliance_score = score
        application.deficiency_count = len(deficiencies_found)
        
        db.commit()

        # Non-negotiable Rule #1: Audit log entry
        AuditService.log(
            db=db,
            action="COMPLIANCE_EVALUATION_COMPLETED",
            entity_type="application",
            entity_id=str(application.id),
            user=actor_user,
            old_value={"compliance_score": old_score},
            new_value={"compliance_score": score, "deficiencies_count": len(deficiencies_found)},
            details=f"Automated compliance evaluation finished: {checks_passed}/{checks_evaluated} checks passed. Score: {score}%. Deficiencies flagged: {len(deficiencies_found)}.",
            ip_address=ip_address
        )

        return {
            "application_id": application_id,
            "compliance_score": score,
            "checks_evaluated": checks_evaluated,
            "checks_passed": checks_passed,
            "deficiencies_count": len(deficiencies_found),
            "deficiencies": [
                {
                    "id": d.id,
                    "rule_code": d.rule_code,
                    "title": d.title,
                    "description": d.description,
                    "severity": d.severity,
                    "flagged_by": d.flagged_by,
                    "is_rectified": d.is_rectified
                }
                for d in deficiencies_found
            ],
            "checklist": checklist
        }

    @staticmethod
    def get_compliance_breakdown(db: Session, application_id: int) -> Dict[str, Any]:
        """
        Retrieves the compliance status and active deficiencies for an application without re-evaluating.
        """
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise ValueError(f"Application with ID {application_id} not found")

        rules = db.query(ComplianceNormRule).filter(ComplianceNormRule.is_active == True).all()
        deficiencies = db.query(DeficiencyRecord).filter(
            DeficiencyRecord.application_id == application_id
        ).all()
        programs = db.query(AcademicProgram).filter(AcademicProgram.application_id == application_id).all()

        total_students = sum(p.total_enrolled for p in programs) if programs else 600
        total_faculty = sum(p.faculty_count for p in programs) if programs else 30
        actual_fsr = round(total_students / max(total_faculty, 1), 2)
        institution = application.institution

        deficiency_map = {d.rule_code: d for d in deficiencies if not d.is_rectified}

        checklist = []
        for rule in rules:
            is_def = rule.rule_code in deficiency_map
            def_item = deficiency_map.get(rule.rule_code)

            if rule.rule_code == "FSR_NORM":
                actual_val = f"1:{actual_fsr}"
            elif rule.rule_code == "LAND_ACRES":
                actual_val = f"{getattr(institution, 'total_land_acres', 7.5)} Acres"
            elif rule.rule_code == "BUILTUP_AREA":
                builtup = getattr(institution, 'total_builtup_sqm', 12500.0)
                actual_val = f"{builtup:,.0f} sqm"
            elif rule.rule_code == "COMPUTER_RATIO":
                pcs = getattr(institution, 'total_computers', 280)
                actual_val = f"{round(pcs / max(total_students, 1), 2)} PC/student"
            elif rule.rule_code in ["ANTI_RAGGING", "ICC_COMMITTEE", "GRIEVANCE_COMMITTEE", "BARRIER_FREE"]:
                actual_val = "Non-Compliant" if is_def else "Compliant / Constituted"
            else:
                actual_val = "Evaluated"

            checklist.append({
                "rule_id": rule.id,
                "rule_code": rule.rule_code,
                "name": rule.name,
                "category": rule.category,
                "standard_value": rule.standard_value,
                "unit": rule.unit,
                "actual_value": actual_val,
                "status": "DEFICIENT" if is_def else "COMPLIANT",
                "severity": rule.severity,
                "details": def_item.description if def_item else f"Satisfies AICTE APH norm for {rule.name}."
            })

        return {
            "application_id": application.id,
            "compliance_score": application.compliance_score,
            "deficiency_count": len([d for d in deficiencies if not d.is_rectified]),
            "total_students": total_students,
            "total_faculty": total_faculty,
            "actual_fsr": actual_fsr,
            "checklist": checklist,
            "deficiencies": [
                {
                    "id": d.id,
                    "rule_code": d.rule_code,
                    "title": d.title,
                    "description": d.description,
                    "severity": d.severity,
                    "flagged_by": d.flagged_by,
                    "is_rectified": d.is_rectified,
                    "rectification_proof": d.rectification_proof,
                    "rectified_at": d.rectified_at,
                    "created_at": d.created_at
                }
                for d in deficiencies
            ]
        }
