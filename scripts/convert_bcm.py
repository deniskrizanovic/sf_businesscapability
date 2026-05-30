#!/usr/bin/env python3
"""
Convert 'Detailed Strategy Mapping' markdown doc into the BCM import JSON format.
Output: docs/homes-nsw-bcm.json
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
SOURCE = ROOT / "docs" / "Detailed Strategy Mapping_ Homes NSW Business Capability Model vs.md"
OUTPUT = ROOT / "docs" / "homes-nsw-bcm.json"

# ---------------------------------------------------------------------------
# Hand-built capability tree parsed from source doc
# ---------------------------------------------------------------------------
# Structure: each domain is L1, each L2 group is L2, each L3 cap is L3.
# externalId: d<N>-g<M>-c<P>  (domain, group, capability)
# tags: [] unless doc marks [NEW] or [MODIFIED]
# rich text fields: wrapped in <p> per import spec
# ---------------------------------------------------------------------------

def p(text):
    """Wrap plain text in <p> tag for rich text field."""
    if not text:
        return ""
    text = text.strip()
    if not text:
        return ""
    return f"<p>{text}</p>"


CAPABILITIES = [
    {
        "externalId": "d0",
        "name": "Cross Cutting",
        "level": 1,
        "sortOrder": 0,
        "definition": p("Capabilities that apply across all domains."),
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d0-c1",
                "name": "Cross System Workflow",
                "level": 2,
                "sortOrder": 1,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": []
            },
            {
                "externalId": "d0-c2",
                "name": "Unified Reporting",
                "level": 2,
                "sortOrder": 2,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": []
            },
            {
                "externalId": "d0-c3",
                "name": "Access Control & Security",
                "level": 2,
                "sortOrder": 3,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": []
            },
        ]
    },
    {
        "externalId": "d1",
        "name": "Portfolio Planning & Development",
        "level": 1,
        "sortOrder": 1,
        "definition": p("Establishes the data-driven investment posture required to shift the agency from reactive planning to proactive system intervention."),
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d1-g1",
                "name": "Housing Needs Analysis",
                "level": 2,
                "sortOrder": 1,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d1-g1-c1",
                        "name": "Waitlist Trend Modelling",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("The predictive analysis of the NSW Social Housing Register to align the $6.6bn build pipeline with evolving demand."),
                        "strategySupport": p("Directly enables the Prioritisation Framework which utilises housing demand as a core metric for site selection. Supports the goal to understand rising housing needs and urgency, specifically identifying homelessness and rental stress as increasing pressures. Informs the new prioritisation framework's housing demand metric."),
                        "architecturalNuance": p("While critical for identifying rising urgency, raw waitlist volumes can be distorted by administrative changes; therefore, serves as a sophisticated diagnostic tool rather than a standalone performance target."),
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d1-g1-c2",
                        "name": "Demographic Shift Analysis",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to forecast changes in household sizes and age profiles to prevent one-size-fits-all development."),
                        "strategySupport": p("Enables targeting new builds for specific, disproportionately affected cohorts: older Australians, women and children escaping domestic and family violence, people living with disabilities, and young people without family support. Supports the allocation of 50% of new homes to women and children escaping domestic and family violence."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d1-g1-c3",
                        "name": "Geographic Shortfall Mapping",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Technical identification of zones where housing supply is inadequate or market failure has occurred."),
                        "strategySupport": p("Fundamental to the Prioritisation Framework to map growth opportunities and geographic access to services. Identifies locations facing market failure in regional and remote NSW for the delivery of key worker housing."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d1-g1-c4",
                        "name": "Spatial & Geospatial Intelligence",
                        "level": 3,
                        "sortOrder": 4,
                        "definition": p("The capability to integrate tools like Ngamuru, ArcGIS, and EstateMaster for property visualisation, allowing the organisation to map geographic access to services and identify regional market failures with visual, data-driven precision."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d1-g2",
                "name": "Development Feasibility Assessment",
                "level": 2,
                "sortOrder": 2,
                "definition": p("Ensures the $5.1 billion supply investment is governed by a social return framework, prioritising stability, health, and economic security over simple financial yields."),
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d1-g2-c1",
                        "name": "Capital Investment CBA",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to perform rigorous cost-benefit analysis for the allocation of the $6.6 billion Building Homes for NSW program."),
                        "strategySupport": p("Ensures value for money and time efficiency, which are explicitly listed as core pillars of the prioritisation framework."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d1-g2-c2",
                        "name": "Social Value Impact Measurement",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to quantify the social returns—such as economic security and wellbeing—generated by housing investments."),
                        "strategySupport": p("Aligns with the strategic assertion that the main driver for social housing is a social return, including the prevention of homelessness."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d1-g2-c3",
                        "name": "Lifecycle ROI Modelling",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Ability to model financial and social returns over the total lifespan of an asset to ensure long-term viability."),
                        "strategySupport": p("Supports the objective of building a sustainable system that is recognised as essential social infrastructure."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d1-g3",
                "name": "Urban, Place-Based & Sustainable Design",
                "level": 2,
                "sortOrder": 3,
                "definition": p("Embeds climate resilience and Silver Level Liveable Housing Design into the 8,400-home pipeline to ensure long-term asset viability and tenant comfort."),
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d1-g3-c1",
                        "name": "Net Zero Carbon Compliance",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Technical ability to ensure developments meet carbon neutrality standards and climate resilience benchmarks."),
                        "strategySupport": p("Directly enables the Net Zero Plan and Climate Change Adaptation Plan to identify priority risks and opportunities. Supports the delivery of environmental sustainability initiatives to approximately 6,000 public homes to reduce tenant energy bills."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d1-g3-c2",
                        "name": "Universal Access Auditing",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Capability to audit and ensure all new builds and modifications meet rigorous accessibility standards."),
                        "strategySupport": p("Delivers the mandate that new social housing must be built to the Liveable Housing Design Guidelines silver level. Supports the decent home definition of being accessible and appropriate for the household."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d1-g3-c3",
                        "name": "Embodied Carbon Tracking",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Ability to monitor and reduce the carbon footprint of materials and construction methods used in new developments."),
                        "strategySupport": p("Supports the broader Net Zero Plan and ensures new social housing is climate resilient."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d1-g4",
                "name": "Key Worker Housing Strategy",
                "level": 2,
                "sortOrder": 4,
                "definition": p("Executes the strategic expansion into non-market housing, specifically addressing regional market failures and providing pathways for very low-to-moderate income households."),
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": ["NEW"],
                "children": [
                    {
                        "externalId": "d1-g4-c1",
                        "name": "Key Worker Housing Operations",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Functional management of housing portfolios specifically for essential government service employees in regional areas."),
                        "strategySupport": p("Directly enables regional and rural service delivery by housing workers in locations facing market failure."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d1-g5",
                "name": "Affordable Housing Strategy",
                "level": 2,
                "sortOrder": 5,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d1-g5-c1",
                        "name": "Affordable Housing Access Management",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Ability to manage the application and allocation process for a more equitable access system for affordable housing."),
                        "strategySupport": p("Enables the target of aiming for 1,200 affordable homes by 2031. Supports the development of a statewide register for non-market housing products."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
        ]
    },
    {
        "externalId": "d2",
        "name": "Property Acquisition & Construction",
        "level": 1,
        "sortOrder": 2,
        "definition": p("Governs value stream alignment for the $6.6 billion Building Homes for NSW program, translating capital into physical social infrastructure."),
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d2-g1",
                "name": "Procurement Management",
                "level": 2,
                "sortOrder": 1,
                "definition": p("Ensures the 8,400 new/replacement homes are delivered through ethical, high-maturity partnerships with CHPs and developers."),
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d2-g1-c1",
                        "name": "Supplier Vetting",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Ability to ensure all construction partners and vendors meet the NSW Government's ethical, safety, and cultural standards."),
                        "strategySupport": p("Aligns with reviewing our procurement and contracting approach to ensure strategic outcomes are sought and rewarded."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d2-g1-c2",
                        "name": "Framework Agreement Negotiation",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Capability to establish long-term, simplified partnership agreements with builders and maintenance providers."),
                        "strategySupport": p("Supports making it easier for our partners to do business with us through the delivery of template agreements."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d2-g1-c3",
                        "name": "Tender Technical Evaluation",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Professional assessment of bids to ensure construction quality meets the standards of the New Homes NSW Design Office."),
                        "strategySupport": p("Ensures high quality delivery of the 8,400 new and replacement social homes."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d2-g2",
                "name": "Construction Project Management",
                "level": 2,
                "sortOrder": 2,
                "definition": p("Directly operationalises the $5.1 billion investment in new supply, managing the delivery risks of the state's largest social housing build."),
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d2-g2-c1",
                        "name": "Construction Risk Management",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("The oversight of site-level financial and structural hazards within the Building Homes for NSW program."),
                        "strategySupport": p("Essential for the secure delivery of the $6.6 billion investment in social housing supply."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d2-g2-c2",
                        "name": "H&S Site Supervision",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Functional oversight of health and safety standards on all Homes NSW construction sites."),
                        "strategySupport": p("Ensures that new assets are safe and well built from the point of inception."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d2-g2-c3",
                        "name": "Milestone Progress Auditing",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Ability to audit construction progress against set timelines to ensure program accountability."),
                        "strategySupport": p("Critical for meeting the transformational target of delivering 8,400 new and replacement social homes by 2031."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d2-g3",
                "name": "Commissioning & Design Management",
                "level": 2,
                "sortOrder": 3,
                "definition": p("Ensures new builds meet the decent home standard and the 50% DV allocation target, providing healthy, safe, and well-designed legacies."),
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d2-g3-c1",
                        "name": "Post-Occupancy Evaluation",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Technical assessment of building performance and tenant experience post-completion to inform future design."),
                        "strategySupport": p("Directly supports the Homes NSW Design Office in ensuring social housing provides a legacy for the future."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d2-g3-c2",
                        "name": "Defect Liability Management",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Capability to manage the rectification of construction defects to ensure asset longevity."),
                        "strategySupport": p("Supports the priority of More and better homes by ensuring new builds are well maintained."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d2-g3-c3",
                        "name": "BIM & Operations Maintenance Handover",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("The technical transition of digital asset data from the $6.6bn construction pipeline into long-term maintenance systems."),
                        "strategySupport": p("Facilitates overall asset management and ensures the new maintenance system has accurate data from day one."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
        ]
    },
    {
        "externalId": "d3",
        "name": "Applicant & Tenancy Management",
        "level": 1,
        "sortOrder": 3,
        "definition": p("Central to Priority 1: Customer-driven service, this domain undergoes an operational capability uplift to replace rationing with person-centred support."),
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d3-g1",
                "name": "Applicant Assessment & Intake",
                "level": 2,
                "sortOrder": 1,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d3-g1-c1",
                        "name": "System-Wide Intake Coordination",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Management of the integrated digital entry point matching customer needs to housing and homelessness services."),
                        "strategySupport": p("Implements the system-wide online entry point matching customer needs to services. Supports the needs assessment process to provide efficient assistance."),
                        "architecturalNuance": "",
                        "tags": ["NEW"],
                        "children": []
                    },
                    {
                        "externalId": "d3-g1-c2",
                        "name": "Vulnerability Scoring",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Capability to assess and prioritise the urgency of applicant needs based on disadvantage and risk."),
                        "strategySupport": p("Aligns with targeting 50% of new homes to women and children escaping domestic and family violence. Ensures vulnerable customers and cohorts are matched to services quickly."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g1-c3",
                        "name": "Fraud & Identity Verification",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Ability to verify applicant eligibility to maintain system integrity."),
                        "strategySupport": p("Supports a system built on fairness and consistency across the system."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g1-c4",
                        "name": "Unique Identity Management",
                        "level": 3,
                        "sortOrder": 4,
                        "definition": p("The ability to provide a unified view of a client across tenancy, homelessness, and asset services—utilising a Unique Person Identifier (UPI)—to ensure a secure and person-centred service pathway."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d3-g2",
                "name": "Tenancy Allocation & Onboarding",
                "level": 2,
                "sortOrder": 2,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d3-g2-c1",
                        "name": "Nominations Agreement Management",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to manage the placement of applicants into properties managed by Community Housing Providers (CHPs)."),
                        "strategySupport": p("Crucial for the multi-provider system and the local coordination approach. Building and implementing a system-wide online entry point matching customer needs to services and products."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g2-c2",
                        "name": "Mutual Exchange & Swap Management",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to facilitate tenants trading homes through an online tool to better meet their evolving needs."),
                        "strategySupport": p("Implements the online tool to assist tenants to proactively swap homes to reduce the transfer list."),
                        "architecturalNuance": "",
                        "tags": ["NEW"],
                        "children": []
                    },
                    {
                        "externalId": "d3-g2-c3",
                        "name": "Periodic Lease Administration",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Ability to manage continuous leases without fixed-term eligibility reviews."),
                        "strategySupport": p("Directly enables abolishing 2, 5 and 10-year fixed-term leases in public housing. Provides tenants more long-term security in their home."),
                        "architecturalNuance": "",
                        "tags": ["MODIFIED"],
                        "children": []
                    },
                    {
                        "externalId": "d3-g2-c4",
                        "name": "Inter-divisional Digital Case Management & Handoff",
                        "level": 3,
                        "sortOrder": 4,
                        "definition": p("The capability to digitally assign, transfer, and track multi-disciplinary cases between teams (e.g., Tenancy, Assets, STT) with automated notifications and shared visibility."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d3-g3",
                "name": "Rental & Arrears Management",
                "level": 2,
                "sortOrder": 3,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d3-g3-c1",
                        "name": "Debt Repayment Negotiation",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to manage rent arrears with empathy and respect to ensure housing stability."),
                        "strategySupport": p("Aligns with reviewing policies to ensure eviction is a last resort."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g3-c2",
                        "name": "Direct Debit Management",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to manage automated payment systems to simplify the customer experience."),
                        "strategySupport": p("Increases efficiency and supports a customer-driven service culture."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g3-c3",
                        "name": "Universal Credit / Income Support Liaison",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Capability to coordinate with welfare agencies to support tenant financial stability."),
                        "strategySupport": p("Supports economic security and tenancy sustainment."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d3-g4",
                "name": "Tenancy Sustainment & Support",
                "level": 2,
                "sortOrder": 4,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d3-g4-c1",
                        "name": "Safeguard Referral Management",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Ability to refer tenants to protective or emergency support services."),
                        "strategySupport": p("Essential for providing support and ensuring homes remain safe spaces."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g4-c2",
                        "name": "Early Intervention Case Management",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Capability to identify and assist households before they reach a crisis point."),
                        "strategySupport": p("Directly supports the goal to connect people to support to sustain tenancies and prevent homelessness. Aims to make homelessness rare, brief and not repeated."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g4-c3",
                        "name": "Digital Self-Service Management",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("The ability to provide and manage a centralised tenant portal where customers can digitally upload evidentiary documents, check application status, report maintenance, and manage routine interactions without manual CSO intervention."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g4-c4",
                        "name": "Automated Field Scheduling & Offline Data Capture",
                        "level": 3,
                        "sortOrder": 4,
                        "definition": p("The capability to automate route planning and enable offline data capture in the field, which increases staff capacity for client engagement, reduces travel overheads, and resolves the inefficiencies of manual scheduling."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g4-c5",
                        "name": "Field Worker Live Tracking & Safety Monitoring",
                        "level": 3,
                        "sortOrder": 5,
                        "definition": p("The operational ability to track field staff in real-time via mobile applications to ensure compliance with occupational health and safety protocols during tenant visits."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g4-c6",
                        "name": "Multichannel Communications",
                        "level": 3,
                        "sortOrder": 6,
                        "definition": p("Capability to automate the communication of routine messages to tenants on the channel of their choice, reducing the administrative burden on frontline staff to allow for more high-value, face-to-face customer service."),
                        "strategySupport": p("Directly supports improving our communications with customers."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g4-c7",
                        "name": "Dynamic Document & Mail Merge Generation",
                        "level": 3,
                        "sortOrder": 7,
                        "definition": p("The ability to auto-generate context-specific letters, legal notices, and application forms by pulling live data directly from the core CRM, eliminating copy-pasting and manual template maintenance."),
                        "strategySupport": p("Directly supports improving our communications with customers."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g4-c8",
                        "name": "Unified Agent Workspace / Customer 360 View",
                        "level": 3,
                        "sortOrder": 8,
                        "definition": p("A centralised, integrated CRM interface that automatically aggregates a tenant's complete history (applications, maintenance, arrears, complaints, and cross-team case notes) into a single dashboard for frontline staff."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g4-c9",
                        "name": "Omni-Channel Routing & Triage",
                        "level": 3,
                        "sortOrder": 9,
                        "definition": p("The capability to automatically assess inbound communications (calls, digital forms) against CRM vulnerability data and route them to specialised queues or priority agents in real-time."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g4-c10",
                        "name": "Digital Literacy Enablement",
                        "level": 3,
                        "sortOrder": 10,
                        "definition": p("Ability to help tenants navigate online solutions for applications and home swaps."),
                        "strategySupport": p("Underpins the move toward online solutions to allow people to understand their eligibility."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d3-g5",
                "name": "Homelessness Service Integration",
                "level": 2,
                "sortOrder": 5,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": ["NEW"],
                "children": [
                    {
                        "externalId": "d3-g5-c1",
                        "name": "Local Collaboration Network Coordination",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to lead regional networks that bring housing and homelessness services together."),
                        "strategySupport": p("Implements the local coordination approach to ensure people are connected to the right support at the right time."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g5-c2",
                        "name": "Crisis Accommodation Placement",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Functional procurement and management of emergency and temporary housing."),
                        "strategySupport": p("Addresses the unprecedented pressure on social housing and crisis services."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d3-g5-c3",
                        "name": "Real-time Disaster Rostering & Expense Tracking",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("The operational ability to actively respond to emergencies by facilitating real-time rostering (for paid volunteers and external staff) and tracking emergency expenses via a centralised risk and compliance platform."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
        ]
    },
    {
        "externalId": "d4",
        "name": "Property & Asset Management",
        "level": 1,
        "sortOrder": 4,
        "definition": p("Manages the structural integrity and environmental performance of the state's largest asset portfolio."),
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d4-g1",
                "name": "Property Compliance Management",
                "level": 2,
                "sortOrder": 1,
                "definition": p("Primary drivers for the transformational target of upgrading 33,500 homes by 2028. Directly enable the strategic goals of thermal comfort and reduced energy bills for tenants."),
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d4-g1-c1",
                        "name": "Asbestos Register Management",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Technical tracking and mitigation of asbestos risks across the portfolio."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d4-g1-c2",
                        "name": "Gas Safety Certification",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Management of mandatory gas safety inspections and compliance."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d4-g1-c3",
                        "name": "Fire Risk Assessment Tracking",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Capability to monitor and execute fire safety audits and upgrades across all dwellings."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d4-g1-c4",
                        "name": "Electrical Inspection Management",
                        "level": 3,
                        "sortOrder": 4,
                        "definition": p("Oversight of periodic electrical safety testing and remediation."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d4-g2",
                "name": "Asset Lifecycle Management",
                "level": 2,
                "sortOrder": 2,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d4-g2-c1",
                        "name": "Property Condition Surveying",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to physically assess the state of the portfolio to transition from the worst landlord to the best."),
                        "strategySupport": p("Provides the data baseline for upgrading 33,500 public and Aboriginal homes by 2028."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d4-g2-c2",
                        "name": "Energy Performance (EPC) Management",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Capability to monitor and improve the thermal efficiency of the social housing portfolio."),
                        "strategySupport": p("Maps to the goal of making homes warmer in winter and cooler in summer and reducing tenant energy bills."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d4-g2-c3",
                        "name": "Retrofit Program Coordination",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Ability to plan and execute large-scale sustainability upgrades."),
                        "strategySupport": p("Enables environmental sustainability initiatives to approximately 6,000 public homes."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d4-g2-c4",
                        "name": "Predictive Maintenance Analytics",
                        "level": 3,
                        "sortOrder": 4,
                        "definition": p("Capability to use data and AI to identify property issues before they escalate."),
                        "strategySupport": p("Directly implements the reform action: Harnessing Artificial Intelligence (AI) to develop predictive maintenance tools."),
                        "architecturalNuance": "",
                        "tags": ["NEW"],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d4-g3",
                "name": "Responsive & Programmed Maintenance Management",
                "level": 2,
                "sortOrder": 3,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d4-g3-c1",
                        "name": "Contractor Work Dispatch",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to assign maintenance tasks to more local suppliers to service their own communities."),
                        "strategySupport": p("Drives the reform to embed and improve the new maintenance system through local provider empowerment."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d4-g3-c2",
                        "name": "Emergency Out-of-Hours Management",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to provide 24/7 property emergency response."),
                        "strategySupport": p("Meets the vision of a landlord that listens and responds quickly."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d4-g4",
                "name": "System-Wide Asset Monitoring",
                "level": 2,
                "sortOrder": 4,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": ["NEW"],
                "children": [
                    {
                        "externalId": "d4-g4-c1",
                        "name": "System-Wide Asset Standards Monitoring",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Ability to oversee and report on maintenance quality across all system providers."),
                        "strategySupport": p("Supports reporting on shared asset standards across the system to ensure a baseline standard for all residents."),
                        "architecturalNuance": "",
                        "tags": ["NEW"],
                        "children": []
                    },
                ]
            },
        ]
    },
    {
        "externalId": "d5",
        "name": "Community & Stakeholder Engagement",
        "level": 1,
        "sortOrder": 5,
        "definition": p("Addresses the social return on investment and the mandate for thriving, empowered communities."),
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d5-g1",
                "name": "Tenant Participation & Empowerment",
                "level": 2,
                "sortOrder": 1,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d5-g1-c1",
                        "name": "Tenant Board Coordination",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to manage formal tenant advisory groups to ensure tenant voice informs policy."),
                        "strategySupport": p("Aligns with bringing tenant participation in-house and strengthening tenant voice."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d5-g1-c2",
                        "name": "Tenant-Led Initiative Support",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to provide resources for projects that build strong communities and empowerment."),
                        "strategySupport": p("Directly supports the goal to support local community and tenant-led initiatives."),
                        "architecturalNuance": "",
                        "tags": ["NEW"],
                        "children": []
                    },
                    {
                        "externalId": "d5-g1-c3",
                        "name": "Tenant Complaints & Feedback Management",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("The ability to actively capture, process, and resolve direct tenant grievances while embedding customer feedback into frontline service improvements."),
                        "strategySupport": p("Directly supported by the Priority 1 (Customer-driven service) action to reform customer service culture by embedding customer feedback to drive system improvement through tenant and community engagement, and improved complaints management."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d5-g2",
                "name": "Community Cohesion",
                "level": 2,
                "sortOrder": 2,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d5-g2-c1",
                        "name": "Anti-social Behaviour Triage & Risk Rating",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to assess and categorise anti-social behaviour reports with fairness and humanity."),
                        "strategySupport": p("Aligns with the revised anti-social behaviour management policy to ensure thriving communities."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
        ]
    },
    {
        "externalId": "d6",
        "name": "Direction Setting & Governance",
        "level": 1,
        "sortOrder": 6,
        "definition": "",
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d6-g1",
                "name": "Risk & Assurance",
                "level": 2,
                "sortOrder": 1,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d6-g1-c1",
                        "name": "Internal Audit Action Tracking",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to monitor the completion of audit recommendations to ensure accountability."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d6-g1-c2",
                        "name": "Business Continuity Testing",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to ensure service delivery continues during crises."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d6-g2",
                "name": "Policy & Compliance Management",
                "level": 2,
                "sortOrder": 2,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d6-g2-c1",
                        "name": "System-Wide Baseline Policy Development",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Ability to create system-wide baseline tenancy policies for rent-setting and succession."),
                        "strategySupport": p("Ensures consistency and fairness across the system regardless of provider."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
        ]
    },
    {
        "externalId": "d7",
        "name": "System Stewardship & Ecosystem Management",
        "level": 1,
        "sortOrder": 7,
        "definition": "",
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d7-g1",
                "name": "Stakeholder Relations",
                "level": 2,
                "sortOrder": 1,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d7-g1-c1",
                        "name": "Local Authority Liaison",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to coordinate with councils as key partners on identifying local housing needs."),
                        "strategySupport": p("Aligns with the goal of delivering the right housing locally."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d7-g1-c2",
                        "name": "Ministerial Correspondence",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Management of formal communications to ensure the Minister's vision for a landlord that listens is enacted."),
                        "strategySupport": p("Supports the role of providing positive leadership as system steward."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d7-g1-c3",
                        "name": "Reputational Risk Monitoring",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Ability to monitor and maintain community trust in the social housing system."),
                        "strategySupport": p("Aligned with measuring collective progress and transformational targets for transparency."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d7-g2",
                "name": "System-Wide Complaints Coordination",
                "level": 2,
                "sortOrder": 2,
                "definition": p("The ability to review, align, and monitor complaint pathways across all independent social housing providers to ensure a consistent standard of dispute resolution across the entire ecosystem."),
                "strategySupport": p("Supported by the strategy's mandate to ensure consistency and fairness as a system steward. Homes NSW must review complaints management across all providers to refine processes that ensure all customers receive consistent, timely and fair outcomes."),
                "architecturalNuance": "",
                "tags": [],
                "children": []
            },
            {
                "externalId": "d7-g3",
                "name": "First Nations Governance & Partnership",
                "level": 2,
                "sortOrder": 3,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d7-g3-c1",
                        "name": "ACHP Partnership & Growth Management",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Ability to support Closing the Gap by expanding management by Aboriginal Community Housing Providers."),
                        "strategySupport": p("Directly supports the target of ensuring 10% of social housing is managed by ACHPs by 2035. Informs the Aboriginal Wellbeing Framework."),
                        "architecturalNuance": "",
                        "tags": ["NEW"],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d7-g4",
                "name": "System Stewardship Operations",
                "level": 2,
                "sortOrder": 4,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": ["NEW"],
                "children": [
                    {
                        "externalId": "d7-g4-c1",
                        "name": "Multi-Provider Growth & Viability Strategy",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("The capability to design strategies that grow the community housing sector and support its viability, specifically by managing bi-directional data flows between Homes NSW and Community Housing Providers (CHPs)."),
                        "strategySupport": p("Directly enables the reform to grow the community housing sector and support sector viability."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
        ]
    },
    {
        "externalId": "d8",
        "name": "Investment & Performance Management",
        "level": 1,
        "sortOrder": 8,
        "definition": "",
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d8-g1",
                "name": "Enterprise Performance Management",
                "level": 2,
                "sortOrder": 1,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d8-g1-c1",
                        "name": "Statutory Return Preparation",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to compile reports that drive action and accountability."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d8-g1-c2",
                        "name": "KPI Performance Benchmarking",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to compare system performance against the 75% tenant satisfaction target."),
                        "strategySupport": p("Essential for tracking progress against Priority 1 transformational targets."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d8-g1-c3",
                        "name": "Shared Measurement & Data Improvement",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Capability to collaborate with partners to create a comprehensive shared measurement framework."),
                        "strategySupport": p("Implements the shared measurement framework and the data improvement strategy."),
                        "architecturalNuance": "",
                        "tags": ["NEW"],
                        "children": []
                    },
                ]
            },
        ]
    },
    {
        "externalId": "d9",
        "name": "Information & Technology",
        "level": 1,
        "sortOrder": 9,
        "definition": "",
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d9-g1",
                "name": "Information Governance & Management",
                "level": 2,
                "sortOrder": 1,
                "definition": "",
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": [],
                "children": [
                    {
                        "externalId": "d9-g1-c1",
                        "name": "Privacy Impact Assessment",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Technical assessment to ensure ethical use of new technologies with a focus on privacy."),
                        "strategySupport": p("Supports harnessing AI while maintaining community trust."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d9-g1-c2",
                        "name": "Master Data Management",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to maintain high-quality data to underpin the online entry point."),
                        "strategySupport": p("Underpins the system-wide online entry point and data improvement strategy."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d9-g1-c3",
                        "name": "Digital Records Retention",
                        "level": 3,
                        "sortOrder": 3,
                        "definition": p("Ability to manage historical tenant and asset records to support accountability."),
                        "strategySupport": p("Ensures transparency and accurate reporting against transformational targets."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d9-g1-c4",
                        "name": "Automated Inter-Agency Data Integration",
                        "level": 3,
                        "sortOrder": 4,
                        "definition": p("The technical capability to establish secure, real-time API connections with external government databases (e.g., Centrelink, Health, Police) to auto-populate tenant profiles, verify subsidies automatically, and flag critical risk factors."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d9-g1-c5",
                        "name": "Real-Time Operational Dashboarding",
                        "level": 3,
                        "sortOrder": 5,
                        "definition": p("The ability to provide localised, self-service dashboards for Team Leaders and CSOs to monitor real-time case volumes, arrears, and task progression without relying on manual spreadsheet extraction."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d9-g1-c6",
                        "name": "In-App Guidance & Contextual Knowledge Management",
                        "level": 3,
                        "sortOrder": 6,
                        "definition": p("The capability to embed digital adoption tools, intuitive user guides, and semantic search directly into the core systems to assist staff with process navigation in real-time."),
                        "strategySupport": "",
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
            {
                "externalId": "d9-g2",
                "name": "Emerging Technology & Automation Management",
                "level": 2,
                "sortOrder": 2,
                "definition": p("Directly executes the Harnessing AI reform action, focusing on Routine Communication Automation to reduce the administrative burden on frontline staff."),
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": ["NEW"],
                "children": [
                    {
                        "externalId": "d9-g2-c1",
                        "name": "Routine Communication Automation",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": p("Capability to use technology for automating routine communications such as updates and reminders."),
                        "strategySupport": p("Directly supports improving our communications with customers."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d9-g2-c2",
                        "name": "Ethical AI Deployment & Privacy Management",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": p("Ability to manage the responsible use of AI for predictive maintenance tools."),
                        "strategySupport": p("Directly implements the reform to harness AI with a focus on privacy and transparency."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
        ]
    },
    {
        "externalId": "d10",
        "name": "People & Culture",
        "level": 1,
        "sortOrder": 10,
        "definition": "",
        "strategySupport": "",
        "architecturalNuance": "",
        "tags": [],
        "children": [
            {
                "externalId": "d10-g1",
                "name": "Cultural Safety & Confidence Enablement",
                "level": 2,
                "sortOrder": 1,
                "definition": p("Essential for meeting Closing the Gap priorities. Ensures the workforce reflects the diversity of the customer base (including those with lived experience), which is a prerequisite for a Customer-driven culture change."),
                "strategySupport": "",
                "architecturalNuance": "",
                "tags": ["NEW"],
                "children": [
                    {
                        "externalId": "d10-g1-c1",
                        "name": "Anti-Racism Strategy Management",
                        "level": 3,
                        "sortOrder": 1,
                        "definition": "",
                        "strategySupport": p("Essential for meeting Closing the Gap priorities."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                    {
                        "externalId": "d10-g1-c2",
                        "name": "Cultural Training Delivery",
                        "level": 3,
                        "sortOrder": 2,
                        "definition": "",
                        "strategySupport": p("Ensures the workforce reflects the diversity of the customer base, including those with lived experience."),
                        "architecturalNuance": "",
                        "tags": [],
                        "children": []
                    },
                ]
            },
        ]
    },
]

# ---------------------------------------------------------------------------

def count_capabilities(caps, depth=0):
    total = len(caps)
    for c in caps:
        total += count_capabilities(c.get("children", []), depth + 1)
    return total


def main():
    payload = {
        "mapName": "Homes NSW Business Capability Model",
        "mapDescription": "<p>Strategy 2025–2035 capability model. Structural reconciliation between the Homes NSW Business Architecture Capability Model and the three core pillars of the Homes for NSW Strategy 2025–2035: Customer-driven service, More and better homes, and A system that works.</p>",
        "capabilities": CAPABILITIES,
    }

    total = count_capabilities(CAPABILITIES)
    print(f"Capability count: {total}")

    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"Written: {OUTPUT}")


if __name__ == "__main__":
    main()
