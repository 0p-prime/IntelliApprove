"""
Compliance Engine: Evaluates AICTE Approval Process Handbook (APH) norms.
All rules are loaded dynamically from the database (Rule #3).
Writes audit log for every compliance run (Rule #1).
Never auto-decides final approval (Rule #2).
"""
from typing import Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.application import Application, AcademicProgram
from app.models.institution import Institution
from app.models.compliance import ComplianceNormRule, DeficiencyRecord
from app.models.user import User
from app.services.audit_service import AuditService

class ComplianceService:
    @staticmethod
    def run_compliance_evaluation(
        db: Session,
        application_id: int,
        actor_user: User = None,
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
        checks_evaluated = 0
        checks_passed = 0

        for rule in rules:
            checks_evaluated += 1
            has_deficiency = False
            title = ""
            desc = ""

            if rule.rule_code == "FSR_NORM":
                # standard value is e.g. 15 (meaning 1:15 ratio)
                if actual_fsr > (rule.standard_value * (1 + rule.threshold_margin_percent / 100)):
                    has_deficiency = True
                    title = f"Faculty-to-Student Ratio Deficiency (1:{actual_fsr})"
                    desc = f"Actual FSR is 1:{actual_fsr}, which violates AICTE APH prescribed maximum 1:{rule.standard_value}. Shortfall of faculty members."
            
            elif rule.rule_code == "LAND_ACRES":
                if institution.total_land_acres < rule.standard_value:
                    has_deficiency = True
                    title = f"Insufficient Land Area ({institution.total_land_acres} Acres)"
                    desc = f"Campus land area ({institution.total_land_acres} acres) is below minimum AICTE norm of {rule.standard_value} acres."

            elif rule.rule_code == "BUILTUP_AREA":
                min_required_sqm = total_students * rule.standard_value  # e.g., 10 sqm per student
                if institution.total_builtup_sqm < min_required_sqm:
                    has_deficiency = True
                    title = f"Shortfall in Built-up Instructional Area ({institution.total_builtup_sqm} sqm)"
                    desc = f"Current built-up area ({institution.total_builtup_sqm} sqm) is below required {min_required_sqm} sqm for {total_students} students."

            elif rule.rule_code == "COMPUTER_RATIO":
                # Standard value e.g. 0.25 (1 PC per 4 students)
                actual_pc_ratio = round(institution.total_computers / max(total_students, 1), 2)
                if actual_pc_ratio < rule.standard_value:
                    has_deficiency = True
                    title = f"Inadequate Computer Terminals ({institution.total_computers} PCs)"
                    desc = f"Computer-to-student ratio is {actual_pc_ratio}, below AICTE norm of {rule.standard_value} (Requires at least {int(total_students * rule.standard_value)} PCs)."

            elif rule.rule_code == "ANTI_RAGGING":
                if not institution.has_anti_ragging_committee:
                    has_deficiency = True
                    title = "Statutory Anti-Ragging Committee Not Constituted"
                    desc = "Institution has not verified constitution of Anti-Ragging Squad and Committee per AICTE Regulations 2009."

            elif rule.rule_code == "ICC_COMMITTEE":
                if not institution.has_icc_committee:
                    has_deficiency = True
                    title = "Internal Complaints Committee (ICC) Missing"
                    desc = "Internal Complaints Committee per POSH Act and AICTE gender sensitization regulations not constituted."

            elif rule.rule_code == "GRIEVANCE_COMMITTEE":
                if not institution.has_grievance_committee:
                    has_deficiency = True
                    title = "Student Grievance Redressal Committee (SGRC) Missing"
                    desc = "Ombudsperson and Student Grievance Committee mandatory registration missing."

            elif rule.rule_code == "BARRIER_FREE":
                if not institution.has_barrier_free_environment:
                    has_deficiency = True
                    title = "Barrier-Free Divyangjan Accessibility Missing"
                    desc = "Campus lacks certified ramps, tactile paths, and accessible restrooms for differently-abled students."

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

        db.flush()

        # Calculate compliance score
        score = round((checks_passed / max(checks_evaluated, 1)) * 100, 1) if checks_evaluated > 0 else 100.0
        old_score = application.compliance_score
        application.compliance_score = score
        application.deficiency_count = len(deficiencies_found)
        application.updated_at = datetime.now(timezone.utc)
        
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
            details=f"Automated compliance evaluation finished: {checks_passed}/{checks_evaluated} checks passed. Score: {score}%.",
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
                    "rule_code": d.rule_code,
                    "title": d.title,
                    "description": d.description,
                    "severity": d.severity
                }
                for d in deficiencies_found
            ]
        }
