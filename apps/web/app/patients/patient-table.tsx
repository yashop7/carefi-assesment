"use client";

import Link from "next/link";
import { useState } from "react";

type Row = {
  id: string;
  patientCode: string;
  name: string;
  claimNumber: string | null;
  documents: number;
  openItems: number;
  latestQuery: string | null;
};

// Filters in the browser, so patient details stay out of URLs and logs.
export function PatientTable({ patients }: { patients: Row[] }) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const shown = patients.filter((patient) =>
    [patient.patientCode, patient.name, patient.claimNumber ?? ""].some((value) =>
      value.toLowerCase().includes(term),
    ),
  );

  return (
    <>
      <label className="field search">
        <span>Search</span>
        <input
          type="search"
          placeholder="Patient ID, name or claim number"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {shown.length === 0 ? (
        <div className="empty">
          <p>No patients match this search.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Patient ID</th>
                <th scope="col">Name</th>
                <th scope="col">Claim number</th>
                <th scope="col" className="number">Documents</th>
                <th scope="col" className="number">Open items</th>
                <th scope="col">Latest query</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((patient) => (
                <tr key={patient.id}>
                  <td className="mono">{patient.patientCode}</td>
                  <td>
                    <Link className="text-link" href={`/patients/${patient.id}`}>
                      {patient.name}
                    </Link>
                  </td>
                  <td>{patient.claimNumber ?? "—"}</td>
                  <td className="number">{patient.documents}</td>
                  <td className="number">{patient.openItems}</td>
                  <td>{patient.latestQuery ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
