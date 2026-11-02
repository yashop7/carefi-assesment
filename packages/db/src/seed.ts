import { db } from './prisma/db';

const body = `Hello {{patient_name}},

Your insurance company needs the following for your claim {{claim_number}}:

{{requested_items}}

Please send these as soon as you can. We already have your other documents, so
there is no need to send them again.

Team CareFi`;

const templates = [
  { channel: 'whatsapp', subject: null, body },
  { channel: 'email', subject: 'Documents needed for your claim {{claim_number}}', body },
] as const;

try {
  let templatesAdded = 0;
  for (const template of templates) {
    const existing = await db.orm.public.Template.where({ channel: template.channel }).first();
    if (!existing) {
      await db.orm.public.Template.create(template);
      templatesAdded++;
    }
  }

  let patientsAdded = 0;
  if (process.env['NODE_ENV'] !== 'production') {
    const existing = await db.orm.public.Patient.where({ patientCode: 'PAT-001' }).first();
    if (!existing) {
      await db.orm.public.Patient.create({
        patientCode: 'PAT-001',
        name: 'Asha Verma',
        phone: '+910000000000',
        email: 'asha@example.com',
        policyNumber: 'HP-4471',
        claimNumber: 'CL-9921',
      });
      patientsAdded++;
    }
  }

  console.log(`Seed finished: ${templatesAdded} templates and ${patientsAdded} patients added`);
} finally {
  await db.close();
}
