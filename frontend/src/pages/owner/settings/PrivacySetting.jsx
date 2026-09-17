import React from "react";

const sections = [
  {
    "title": "1. Account & Business Information",
    "paragraphs": [
      "Calai processes information needed to provide and manage your account and the Calai service. This may include business information, authorised user details, account settings, login and security information, support communications and subscription information.",
      "We use this information to operate the service, administer your account, provide support, maintain security, communicate important service information and meet applicable legal obligations."
    ]
  },
  {
    "title": "2. Customer Calls & Orders",
    "paragraphs": [
      "When a customer calls your business through the Calai service, Calai may process information provided during the call. Depending on the purpose of the call, this may include the caller's telephone number, name, postcode, delivery address, order details, special requests and other information the caller chooses to provide.",
      "This information is processed so that the virtual assistant can understand and respond to the caller, handle an order or enquiry and provide the relevant information to your business."
    ]
  },
  {
    "title": "3. Call Recording & Transcription",
    "paragraphs": [
      "Calls handled by the Calai virtual assistant may be recorded and transcribed. Call recordings, transcripts and associated caller or order information are retained for up to 30 days and are then deleted in accordance with Calai's retention policy, unless information must be retained for a legal or regulatory reason.",
      "Access to this information is restricted to authorised persons where access is necessary to operate, support, secure or investigate the service."
    ]
  },
  {
    "title": "4. How Information Is Used",
    "paragraphs": [
      "Calai uses personal information where necessary to provide the AI call-handling service, process customer requests and orders, maintain service reliability and security, troubleshoot technical issues, provide support and comply with applicable legal obligations."
    ]
  },
  {
    "title": "5. Service Providers & Data Protection",
    "paragraphs": [
      "Calai uses selected technology and service providers where necessary to operate the service. These may include providers involved in telephony, artificial intelligence, speech processing, hosting, communications and payments.",
      "Information may be processed by these providers where necessary to provide the Calai service. Calai does not sell personal information. Appropriate technical and organisational measures are used to protect personal information."
    ]
  },
  {
    "title": "6. Data Retention",
    "paragraphs": [
      "Calai keeps personal information only for as long as it is needed for the purpose for which it was collected, to operate and secure the service, or to meet legal obligations. Different categories of information may have different retention periods. Call recordings, transcripts and associated caller or order information are retained for up to 30 days unless a different period is legally required."
    ]
  },
  {
    "title": "7. Data Protection Rights",
    "paragraphs": [
      "Individuals may have rights under UK data protection law in relation to their personal information. Depending on the circumstances, these may include rights of access, correction, erasure, restriction, objection and data portability.",
      "Full information about how Calai processes personal information, applicable lawful bases, data sharing, international transfers, retention and individual rights is provided in the Calai Privacy Notice."
    ]
  },
  {
    "title": "Privacy Notice",
    "paragraphs": [
      "For full details about how Calai handles personal information, please read the Calai Privacy Notice."
    ]
  }
];

const PrivacySetting = () => (
  <article className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
    <header className="mb-8">
      <p className="text-xs font-semibold tracking-widest text-blue-400 mb-2">CALAI</p>
      <h2 className="text-xl font-semibold text-white mb-1">Privacy &amp; Data</h2>
      <p className="text-sm text-gray-400">How Calai handles your data</p>
    </header>
    <div className="space-y-7 text-gray-300 text-sm md:text-[15px] leading-relaxed">
      {sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h3 className="font-semibold text-white mb-3">{section.title}</h3>
          <div className="space-y-3">
            {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        </section>
      ))}
    </div>
  </article>
);

export default PrivacySetting;
