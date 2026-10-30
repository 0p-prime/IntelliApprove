import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'hi';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Nav & System
    'nav.dashboard': 'Dashboard',
    'nav.applications': 'Applications',
    'nav.my_applications': 'My Applications',
    'nav.new_application': 'New Application',
    'nav.evc': 'EVC Physical Inspections',
    'nav.assigned_inspections': 'Assigned Inspections',
    'nav.undertakings': 'Undertakings Compliance',
    'nav.documents': 'Document & Lease Validity',
    'nav.alerts': 'Alerts & Escalations',
    'nav.reports': 'Statutory Reports',
    'nav.audit': 'Cryptographic Audit Trail',
    'nav.integration': 'Portal Bridge',
    'nav.admin_settings': 'Admin Settings',
    'nav.workflow_routes': 'Workflow Routes',
    'nav.escalations': 'Escalation Ladder',
    'nav.compliance_rules': 'Compliance Rules',
    'nav.logout': 'Sign Out',
    'system.title': 'IntelliApprove',
    'system.tagline': 'Automate. Monitor. Comply.',

    // Common Actions
    'action.search': 'Search',
    'action.filter': 'Filter',
    'action.reset': 'Reset Filters',
    'action.export_csv': 'Export to Excel (CSV)',
    'action.print': 'Print / Save PDF',
    'action.refresh': 'Refresh',
    'action.submit': 'Submit',
    'action.cancel': 'Cancel',
    'action.verify': 'Verify',
    'action.reject': 'Reject',
    'action.return': 'Return Application',
    'action.complete_stage': 'Complete Stage & Advance',
    'action.inspect': 'Inspect',
    'action.view_details': 'View Details',
    'action.ask_ai': 'Ask AI Assistant',

    // Dashboard Cards
    'dash.total_applications': 'Total Pipeline Applications',
    'dash.in_progress': 'Under Active Clearance',
    'dash.sla_breaches': 'SLA Overdue Breaches',
    'dash.approved_campuses': 'Approved Technical Campuses',
    'dash.high_risk': 'High Delay Risk Cases',
    'dash.approval_rate': 'National Approval Rate',
    'dash.top_overdue': 'Top Overdue Applications',
    'dash.why_score': 'Why this score?',

    // Stages
    'stage.submitted': 'Application Submitted',
    'stage.scrutiny': 'Preliminary Scrutiny',
    'stage.evc': 'Expert Visit Committee (EVC)',
    'stage.sac_shc': 'SAC / SHC Hearing',
    'stage.bureau_decision': 'Bureau Competent Authority Decision',
    'stage.approved': 'Statutory Approval Granted',
    'stage.rejected': 'Approval Refused',
    'stage.returned': 'Returned for Clarification',

    // Statuses
    'status.pending': 'PENDING',
    'status.queued': 'QUEUED',
    'status.scheduled': 'SCHEDULED',
    'status.due_soon': 'DUE SOON',
    'status.overdue': 'OVERDUE',
    'status.completed': 'COMPLETED',
    'status.verified': 'VERIFIED',
    'status.valid': 'VALID',
    'status.critical': 'CRITICAL',
    'status.expired': 'EXPIRED',
    'status.low_risk': 'LOW RISK',
    'status.med_risk': 'MEDIUM RISK',
    'status.high_risk': 'HIGH RISK',

    // Assistant & OCR
    'assistant.title': 'Statutory Assistant',
    'assistant.placeholder': 'Ask e.g. "Show overdue EVCs in Western region" or "Draft deficiency notice"',
    'assistant.disclaimer': 'AI Draft: Requires human official review and confirmation before dispatch.',
    'ocr.title': 'Lease OCR Assist',
    'ocr.scanning': 'Scanning document for expiry tenure clauses...',
    'ocr.suggested': 'OCR Extracted Expiry Date',
    'ocr.notice': 'Pre-filled via OCR. Please verify against physical document.'
  },
  hi: {
    // Nav & System
    'nav.dashboard': 'डैशबोर्ड',
    'nav.applications': 'आवेदन सूची',
    'nav.my_applications': 'मेरे आवेदन',
    'nav.new_application': 'नया आवेदन',
    'nav.evc': 'ई.वी.सी. भौतिक निरीक्षण',
    'nav.assigned_inspections': 'सौंपे गए निरीक्षण',
    'nav.undertakings': 'वचनबद्धता अनुपालन',
    'nav.documents': 'दस्तावेज व पट्टा वैधता',
    'nav.alerts': 'अलर्ट व एस्केलेशन',
    'nav.reports': 'सांविधिक रिपोर्ट',
    'nav.audit': 'क्रिप्टोग्राफिक ऑडिट खाता',
    'nav.integration': 'पोर्टल ब्रिज',
    'nav.admin_settings': 'प्रशासन सेटिंग्स',
    'nav.workflow_routes': 'कार्यप्रवाह मार्ग',
    'nav.escalations': 'एस्केलेशन सीढ़ी',
    'nav.compliance_rules': 'अनुपालन नियम',
    'nav.logout': 'लॉग आउट',
    'system.title': 'इन्टेली-एप्रूव',
    'system.tagline': 'स्वचालन। निगरानी। अनुपालन।',

    // Common Actions
    'action.search': 'खोजें',
    'action.filter': 'फ़िल्टर',
    'action.reset': 'रीसेट करें',
    'action.export_csv': 'एक्सेल में निर्यात (CSV)',
    'action.print': 'प्रिंट / PDF रिपोर्ट',
    'action.refresh': 'ताज़ा करें',
    'action.submit': 'जमा करें',
    'action.cancel': 'रद्द करें',
    'action.verify': 'सत्यापित करें',
    'action.reject': 'अस्वीकृत करें',
    'action.return': 'आवेदन वापस लौटाएं',
    'action.complete_stage': 'चरण पूर्ण करें व आगे बढ़ें',
    'action.inspect': 'निरीक्षण करें',
    'action.view_details': 'विवरण देखें',
    'action.ask_ai': 'एआई सहायक से पूछें',

    // Dashboard Cards
    'dash.total_applications': 'कुल पाइपलाइन आवेदन',
    'dash.in_progress': 'सक्रिय संवीक्षा अधीन',
    'dash.sla_breaches': 'समय-सीमा पार (अतिदेय)',
    'dash.approved_campuses': 'स्वीकृत तकनीकी परिसर',
    'dash.high_risk': 'उच्च विलंब जोखिम वाले मामले',
    'dash.approval_rate': 'राष्ट्रीय स्वीकृति दर',
    'dash.top_overdue': 'शीर्ष अतिदेय आवेदन',
    'dash.why_score': 'यह स्कोर क्यों?',

    // Stages
    'stage.submitted': 'आवेदन प्रस्तुत',
    'stage.scrutiny': 'प्रारंभिक संवीक्षा',
    'stage.evc': 'विशेषज्ञ समिति (EVC) निरीक्षण',
    'stage.sac_shc': 'स्थायी समिति (SAC/SHC) सुनवाई',
    'stage.bureau_decision': 'ब्यूरो सक्षम प्राधिकारी निर्णय',
    'stage.approved': 'सांविधिक स्वीकृति प्रदान',
    'stage.rejected': 'स्वीकृति अस्वीकृत',
    'stage.returned': 'स्पष्टीकरण हेतु लौटाया गया',

    // Statuses
    'status.pending': 'लंबित',
    'status.queued': 'पंक्तिबद्ध',
    'status.scheduled': 'निर्धारित',
    'status.due_soon': 'शीघ्र देय',
    'status.overdue': 'अतिदेय',
    'status.completed': 'पूर्ण',
    'status.verified': 'सत्यापित',
    'status.valid': 'वैध',
    'status.critical': 'संकटपूर्ण',
    'status.expired': 'समाप्त',
    'status.low_risk': 'कम जोखिम',
    'status.med_risk': 'मध्यम जोखिम',
    'status.high_risk': 'उच्च जोखिम',

    // Assistant & OCR
    'assistant.title': 'सांविधिक सहायक',
    'assistant.placeholder': 'पूछें, जैसे "पश्चिमी क्षेत्र में अतिदेय EVC दिखाएं" या "कमी का नोटिस तैयार करें"',
    'assistant.disclaimer': 'एआई प्रारूप: प्रेषण से पूर्व सक्षम अधिकारी द्वारा समीक्षा व अनुमोदन अनिवार्य है।',
    'ocr.title': 'पट्टा ओ.सी.आर. सहायता',
    'ocr.scanning': 'दस्तावेज में पट्टा समाप्ति तिथि खोजी जा रही है...',
    'ocr.suggested': 'ओ.सी.आर. द्वारा निकाली गई समाप्ति तिथि',
    'ocr.notice': 'ओसीआर द्वारा स्वतः भरा गया। कृपया मूल दस्तावेज से मिलान करें।'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (k, fb) => fb || k,
});

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('preferred_language') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  const t = (key: string, fallback?: string): string => {
    return TRANSLATIONS[language]?.[key] || fallback || TRANSLATIONS['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
