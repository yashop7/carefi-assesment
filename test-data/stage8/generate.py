# Writes 11 fake patients, their lockers, 19 letters and each letter's correct answer.
# Every name and number here is made up. Run: python3 test-data/stage8/generate.py
import json
import random
import shutil
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).parent
FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 30)
HOSPITAL = "City Care Hospital, Pune"

PATIENTS = {
    "PAT-801": "Asha Verma",
    "PAT-802": "Ravi Kumar",
    "PAT-803": "Sita Rao",
    "PAT-804": "Imran Shaikh",
    "PAT-805": "Meena Iyer",
    "PAT-806": "Arjun Nair",
    "PAT-807": "Farah Khan",
    "PAT-808": "Deepak Yadav",
    "PAT-809": "Lata Menon",
    "PAT-810": "Harpreet Singh",
    "PAT-811": "Vikram Desai",
}


# Each patient's policy and claim number, the same as patients.csv.
NUMBERS = {name: (f"HP-80{i:02d}", f"CL-80{i:02d}") for i, name in enumerate(PATIENTS.values(), 1)}
NUMBERS["Neha Joshi"] = ("HP-9901", "CL-9901")
NUMBERS["Kavita Joshi"] = ("HP-9902", "CL-9902")


def with_numbers(lines):
    out = []
    for line in lines:
        out.append(line)
        if line.startswith(("Patient: ", "Insured: ")):
            policy, claim = NUMBERS[line.split(": ", 1)[1]]
            out += [f"Policy number: {policy}", f"Claim number: {claim}"]
    return out


def discharge(name):
    return [HOSPITAL, "DISCHARGE SUMMARY", f"Patient: {name}", "Admitted: 12 March 2026", "Discharged: 15 March 2026",
            "Diagnosis: Acute appendicitis", "Treatment: Laparoscopic appendectomy under general anaesthesia.",
            "Condition at discharge: Stable. Review after 7 days.", "Dr. S. Kulkarni, Consultant Surgeon"]


def summary_bill(name):
    return [HOSPITAL, "HOSPITAL BILL - SUMMARY", f"Patient: {name}", "Bill date: 15 March 2026",
            "Room charges total: Rs 18,000", "Medical charges total: Rs 42,500", "Grand total: Rs 60,500"]


def itemised_bill(name):
    return [HOSPITAL, "DETAILED ITEMISED BILL", f"Patient: {name}", "Bill date: 15 March 2026",
            "12 Mar Room rent, 3 days at Rs 6,000: Rs 18,000", "13 Mar Surgeon fee: Rs 20,000",
            "13 Mar Anaesthetist fee: Rs 6,000", "13 Mar Operation theatre: Rs 9,000",
            "14 Mar Injection Ceftriaxone, 6 units: Rs 3,000", "14 Mar Blood test CBC: Rs 800",
            "15 Mar Nursing charges: Rs 3,700", "Grand total: Rs 60,500"]


def pharmacy_bill(name):
    return ["Wellness Pharmacy, Pune", "PHARMACY BILL", f"Patient: {name}", "Date: 15 March 2026",
            "Tab Paracetamol 650 mg x 10: Rs 40", "Tab Cefixime 200 mg x 10: Rs 210", "Total: Rs 250"]


def lab_report(name, date="13 March 2026"):
    return ["Metro Diagnostics, Pune", "LABORATORY REPORT - COMPLETE BLOOD COUNT", f"Patient: {name}", f"Sample date: {date}",
            "Haemoglobin: 13.2 g/dL", "WBC count: 12,400 /uL", "Platelets: 2.4 lakh /uL"]


def mri_report(name):
    return ["Metro Diagnostics, Pune", "MRI ABDOMEN REPORT", f"Patient: {name}", "Scan date: 12 March 2026",
            "Findings: Inflamed appendix. No free fluid.", "Dr. R. Shah, Radiologist"]


def consultation(name):
    return ["Dr. S. Kulkarni, Surgeon, Pune", "CONSULTATION NOTE", f"Patient: {name}", "Date: 10 March 2026",
            "Complaint: Pain in right lower abdomen for 2 days.", "Advice: MRI abdomen. Admit if pain continues."]


def policy(name):
    return ["Sunrise Health Insurance Ltd", "HEALTH INSURANCE POLICY SCHEDULE", f"Insured: {name}",
            "Policy period: 1 April 2025 to 31 March 2026", "Sum insured: Rs 5,00,000"]


def aadhaar(name):
    return ["GOVERNMENT OF INDIA", "AADHAAR", f"Name: {name}", "Year of birth: 1980", "Number: XXXX XXXX 4821"]


def cheque(name):
    return ["State Bank of India, Pune Branch", "CANCELLED", f"Account holder: {name}",
            "Account number: 0000 1234 5678", "IFSC: SBIN0000001", "This cheque is cancelled and not for payment."]


# file name -> pages, each page being a list of lines. "scan" and "blur" make image-only PDFs.
def lockers():
    combined = [discharge("Sita Rao"), itemised_bill("Sita Rao"), lab_report("Sita Rao")]
    return {
        "PAT-801": {"discharge-summary.pdf": [discharge("Asha Verma")], "summary-bill.pdf": [summary_bill("Asha Verma")],
                    "policy-copy.pdf": [policy("Asha Verma")]},
        "PAT-802": {"discharge-summary.pdf": [discharge("Ravi Kumar")], "itemised-bill.pdf": [itemised_bill("Ravi Kumar")],
                    "summary-bill.pdf": [summary_bill("Ravi Kumar")], "lab-report.pdf": [lab_report("Ravi Kumar")],
                    "pharmacy-bill.pdf": [pharmacy_bill("Ravi Kumar")]},
        "PAT-803": {"combined-hospital-file.pdf": combined, "policy-copy.pdf": [policy("Sita Rao")]},
        "PAT-804": {"discharge-summary.pdf": [discharge("Imran Shaikh")], "summary-bill.pdf": [summary_bill("Imran Shaikh")],
                    "lab-report-other-person.pdf": [lab_report("Neha Joshi")]},
        "PAT-805": {"scanned-discharge.pdf": ("scan", discharge("Meena Iyer")),
                    "scanned-itemised-bill.pdf": ("scan", itemised_bill("Meena Iyer")),
                    "aadhaar-card.pdf": [aadhaar("Meena Iyer")]},
        "PAT-806": {"blurry-discharge.pdf": ("blur", discharge("Arjun Nair")), "policy-copy.pdf": [policy("Arjun Nair")],
                    "cancelled-cheque.pdf": [cheque("Arjun Nair")]},
        "PAT-807": {"aadhaar-card.pdf": [aadhaar("Farah Khan")]},
        "PAT-808": {"discharge-summary.pdf": [discharge("Deepak Yadav")], "itemised-bill.pdf": [itemised_bill("Deepak Yadav")],
                    "pharmacy-bill.pdf": [pharmacy_bill("Deepak Yadav")], "lab-report.pdf": [lab_report("Deepak Yadav")],
                    "consultation-paper.pdf": [consultation("Deepak Yadav")], "policy-copy.pdf": [policy("Deepak Yadav")],
                    "aadhaar-card.pdf": [aadhaar("Deepak Yadav")], "cancelled-cheque.pdf": [cheque("Deepak Yadav")]},
        "PAT-809": {"discharge-summary.pdf": [discharge("Lata Menon")], "consultation-paper.pdf": [consultation("Lata Menon")],
                    "lab-report-old.pdf": [lab_report("Lata Menon", "10 January 2025")]},
        "PAT-810": {"discharge-summary.pdf": [discharge("Harpreet Singh")], "summary-bill.pdf": [summary_bill("Harpreet Singh")],
                    "mri-report.pdf": [mri_report("Harpreet Singh")]},
        # No blurry file here: one unreadable document sends every "ask the patient" point to the team.
        "PAT-811": {"discharge-summary.pdf": [discharge("Vikram Desai")], "itemised-bill.pdf": [itemised_bill("Vikram Desai")],
                    "policy-copy.pdf": [policy("Vikram Desai")], "lab-report-old.pdf": [lab_report("Vikram Desai", "10 January 2025")],
                    "mri-report-other-person.pdf": [mri_report("Neha Joshi")]},
    }


LOCKER = "already_in_locker"
ASK = "needed_from_patient"
TEAM = "needs_team"
UNREADABLE = [{"asks": "Read this letter", "match": ["read this letter"], "status": TEAM}]


def point(asks, match, status, document=None):
    return {"asks": asks, "match": match, "status": status, **({"document": document} if document else {})}


# Each match word must be in the point the agent found. "a|b" means either word.
LETTERS = [
    ("L01", "PAT-801", "several-requests",
     "Kindly provide the itemised hospital bill, the pharmacy bills and all investigation reports for this hospitalisation.",
     [point("Itemised bill", ["itemi"], ASK), point("Pharmacy bills", ["pharmacy"], ASK),
      point("Investigation reports", ["investigation|report"], ASK)]),
    ("L02", "PAT-801", "summary-bill-not-itemised",
     "Please submit a detailed itemised hospital bill showing room, medicine and surgeon charges separately. Please also share the discharge summary.",
     [point("Itemised bill", ["itemi"], ASK), point("Discharge summary", ["discharge"], LOCKER, "discharge-summary.pdf")]),
    ("L03", "PAT-802", "already-in-locker",
     "Please provide the discharge summary, the itemised hospital bill and the blood test report.",
     [point("Discharge summary", ["discharge"], LOCKER, "discharge-summary.pdf"),
      point("Itemised bill", ["itemi"], LOCKER, "itemised-bill.pdf"),
      point("Blood test report", ["blood|test|report"], LOCKER, "lab-report.pdf")]),
    ("L04", "PAT-802", "hospital-only",
     "The treating hospital must confirm in writing the tariff applied for the ICU charges. The treating doctor must state why the ICU stay was medically necessary. Please also send the pharmacy bill.",
     [point("Tariff confirmation", ["tariff"], TEAM), point("Doctor's reason for ICU", ["doctor|necessary"], TEAM),
      point("Pharmacy bill", ["pharmacy"], LOCKER, "pharmacy-bill.pdf")]),
    ("L05", "PAT-803", "combined-pdf",
     "Please provide the discharge summary, the itemised hospital bill and the blood test report.",
     [point("Discharge summary", ["discharge"], LOCKER, "combined-hospital-file.pdf"),
      point("Itemised bill", ["itemi"], LOCKER, "combined-hospital-file.pdf"),
      point("Blood test report", ["blood|test|report"], LOCKER, "combined-hospital-file.pdf")]),
    ("L06", "PAT-803", "combined-pdf-missing-item",
     "Please provide the pharmacy bill and a copy of the insurance policy.",
     [point("Pharmacy bill", ["pharmacy"], ASK), point("Policy copy", ["policy"], LOCKER, "policy-copy.pdf")]),
    ("L07", "PAT-804", "other-patients-document",
     "Please provide the blood test report and the discharge summary.",
     [point("Blood test report", ["blood|test|report"], TEAM), point("Discharge summary", ["discharge"], LOCKER, "discharge-summary.pdf")]),
    ("L08", "PAT-805", "scanned-letter",
     "Please provide a cancelled cheque and the itemised hospital bill.",
     [point("Cancelled cheque", ["cheque"], ASK), point("Itemised bill", ["itemi"], LOCKER, "scanned-itemised-bill.pdf")]),
    ("L09", "PAT-806", "blurry-letter",
     "Please provide the itemised hospital bill, the pharmacy bills and the test reports.", UNREADABLE),
    ("L10", "PAT-806", "blurry-document",
     "Please provide the discharge summary and a cancelled cheque.",
     [point("Discharge summary", ["discharge"], TEAM), point("Cancelled cheque", ["cheque"], LOCKER, "cancelled-cheque.pdf")]),
    ("L11", "PAT-807", "vague-wording",
     "Please submit all relevant documents pertaining to the treatment to enable us to process your claim further.",
     [point("Relevant documents", ["document"], TEAM)]),
    ("L12", "PAT-807", "nothing-in-locker",
     "Please provide the discharge summary, the final hospital bill and a copy of the insurance policy.",
     [point("Discharge summary", ["discharge"], ASK), point("Final bill", ["bill"], ASK), point("Policy copy", ["policy"], ASK)]),
    ("L13", "PAT-808", "no-message-needed",
     "Please provide a copy of the insurance policy, a cancelled cheque and an identity proof.",
     [point("Policy copy", ["policy"], LOCKER, "policy-copy.pdf"), point("Cancelled cheque", ["cheque"], LOCKER, "cancelled-cheque.pdf"),
      point("Identity proof", ["identity|id "], LOCKER, "aadhaar-card.pdf")]),
    ("L14", "PAT-808", "one-sentence-with-details",
     "Kindly provide a cancelled cheque bearing the patient's name together with a copy of the PAN card and the Aadhaar card.",
     [point("Cancelled cheque", ["cheque"], LOCKER, "cancelled-cheque.pdf"), point("PAN card", ["pan"], ASK),
      point("Aadhaar card", ["aadhaar"], LOCKER, "aadhaar-card.pdf")]),
    ("L15", "PAT-809", "wrong-date-in-locker",
     "Please provide the blood test report for the hospital stay from 12 March 2026 to 15 March 2026, and the consultation paper from before the admission.",
     [point("Blood test report for the stay", ["blood|test|report"], ASK),
      point("Consultation paper", ["consultation"], LOCKER, "consultation-paper.pdf")]),
    ("L16", "PAT-809", "letter-for-someone-else",
     "Please provide the discharge summary and the itemised hospital bill.",
     [point("Discharge summary", ["discharge"], TEAM), point("Itemised bill", ["itemi"], TEAM)]),
    ("L17", "PAT-810", "mixed-and-vague",
     "Please provide the MRI report and the itemised hospital bill. Please also clarify the past history.",
     [point("MRI report", ["mri"], LOCKER, "mri-report.pdf"), point("Itemised bill", ["itemi"], ASK),
      point("Past history", ["history"], TEAM)]),
    ("L18", "PAT-810", "nothing-requested",
     "We are pleased to inform you that your claim is under process. No further documents are required at this time.", UNREADABLE),
    ("L19", "PAT-811", "all-three-cases",
     "Please provide the discharge summary, the itemised hospital bill and a copy of the insurance policy. "
     "Please also provide the pharmacy bills, a cancelled cheque and the blood test report for the hospital stay "
     "from 12 March 2026 to 15 March 2026. We also need the MRI report. The treating hospital must confirm in writing "
     "the tariff applied for the room charges. Please also clarify the past history.",
     [point("Discharge summary", ["discharge"], LOCKER, "discharge-summary.pdf"),
      point("Itemised bill", ["itemi"], LOCKER, "itemised-bill.pdf"),
      point("Policy copy", ["policy"], LOCKER, "policy-copy.pdf"),
      point("Pharmacy bills", ["pharmacy"], ASK), point("Cancelled cheque", ["cheque"], ASK),
      point("Blood test report for the stay", ["blood|test|report"], ASK),
      point("MRI report", ["mri"], TEAM), point("Tariff confirmation", ["tariff"], TEAM),
      point("Past history", ["history"], TEAM)]),
]


def letter_lines(code, body):
    name = "Kavita Joshi" if code == "L16" else None
    return lambda patient: ["Sunrise Health Insurance Ltd", "Claims Department", "Date: 20 March 2026",
                            f"Patient: {name or patient}",
                            "Subject: Query on your health insurance claim", "", "Dear Sir or Madam,", "",
                            *textwrap.wrap(body, 72), "", "Please respond within 15 days.", "", "Claims Team"]


def text_pdf(path, pages):
    objects = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for lines in pages:
        escaped = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in lines]
        stream = "BT /F1 12 Tf 60 780 Td 18 TL " + " ".join(f"({line}) Tj T*" for line in escaped) + " ET"
        objects.append(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents {len(objects)} 0 R /Resources << /Font << /F1 3 0 R >> >> >>")
        kids.append(f"{len(objects)} 0 R")
    objects[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>"

    out = "%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n{body}\nendobj\n"
    start = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    out += "".join(f"{offset:010d} 00000 n \n" for offset in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n"
    path.write_text(out, encoding="latin-1")


def image_pdf(path, lines, blur):
    image = Image.new("L", (1000, 1400), 245)
    draw = ImageDraw.Draw(image)
    for index, line in enumerate(lines):
        draw.text((70, 80 + index * 46), line, fill=30, font=FONT)
    image = image.rotate(1.2, fillcolor=245).filter(ImageFilter.GaussianBlur(blur))
    pixels = image.load()
    for _ in range(40000):
        pixels[random.randrange(1000), random.randrange(1400)] = random.randrange(90, 230)
    image.convert("RGB").save(path, "PDF", resolution=120, quality=40 if blur > 3 else 70)


def write_file(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, tuple):
        kind, lines = content
        image_pdf(path, with_numbers(lines), 11 if kind == "blur" else 0.6)
    else:
        text_pdf(path, [with_numbers(lines) for lines in content])


def main():
    random.seed(8)
    for folder in ("lockers", "letters"):
        shutil.rmtree(ROOT / folder, ignore_errors=True)

    rows = ["patientCode,name,phone,email,policyNumber,claimNumber"]
    for index, (code, name) in enumerate(PATIENTS.items(), 1):
        rows.append(f"{code},{name},+9190000080{index:02d},{code.lower()}@example.com,HP-80{index:02d},CL-80{index:02d}")
    (ROOT / "patients.csv").write_text("\n".join(rows) + "\n")

    for code, files in lockers().items():
        for file_name, content in files.items():
            write_file(ROOT / "lockers" / code / file_name, content)

    for letter, code, case, body, points in LETTERS:
        lines = letter_lines(letter, body)(PATIENTS[code])
        stem = f"{letter}-{code}-{case}"
        kind = {"L08": "scan", "L09": "blur"}.get(letter)
        write_file(ROOT / "letters" / code / f"{stem}.pdf", (kind, lines) if kind else [lines])
        answer = {"letter": letter, "patient": code, "case": case, "file": f"{stem}.pdf", "points": points}
        (ROOT / "letters" / code / f"{stem}-answer.json").write_text(json.dumps(answer, indent=2) + "\n")

    print(f"{len(PATIENTS)} patients, {len(LETTERS)} letters")


main()
