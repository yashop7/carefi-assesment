"use client";

import Link from "next/link";
import { useState } from "react";
import { queryBadgeClass } from "@/lib/format";
import { Avatar } from "../avatar";

type Row = {
  id: string;
  patientCode: string;
  name: string;
  claimNumber: string | null;
  documents: number;
  openItems: number;
  latestQuery: string | null;
};

type View = { label: string; matches: (patient: Row) => boolean };

const ALL: View = { label: "All patients", matches: () => true };
const VIEWS: View[] = [
  ALL,
  { label: "Need attention", matches: ({ latestQuery }) => !!latestQuery && queryBadgeClass(latestQuery).includes("warn") },
  { label: "With open items", matches: ({ openItems }) => openItems > 0 },
  { label: "No documents", matches: ({ documents }) => documents === 0 },
];

// Filters in the browser, so patient details stay out of URLs and logs.
export function PatientTable({ patients }: { patients: Row[] }) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState(ALL);
  const term = search.trim().toLowerCase();
  const shown = patients.filter(view.matches).filter((patient) =>
    [patient.patientCode, patient.name, patient.claimNumber ?? ""].some((value) =>
      value.toLowerCase().includes(term),
    ),
  );

  return (
    <>
      <div className="stats" role="group" aria-label="Filter patients">
        {VIEWS.map((option) => (
          <button
            key={option.label}
            type="button"
            className="stat"
            aria-pressed={option === view}
            onClick={() => setView(option)}
          >
            {option.label}
            <strong>{patients.filter(option.matches).length}</strong>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <label className="field search">
          <span className="visually-hidden">Search patients</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <input
            type="search"
            name="search"
            autoComplete="off"
            placeholder="Search by ID, name or claim…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span className="muted nowrap">
          {shown.length} of {patients.length}
        </span>
      </div>
      {shown.length === 0 ? (
        <div className="empty">
          <p>No patients match this view.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Patient ID</th>
                <th scope="col">Claim number</th>
                <th scope="col" className="number">Documents</th>
                <th scope="col" className="number">Open items</th>
                <th scope="col">Latest query</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((patient) => (
                <tr className="row" key={patient.id}>
                  <td>
                    <div className="person">
                      <Avatar name={patient.name} />
                      <Link className="row-link" href={`/patients/${patient.id}`}>
                        {patient.name}
                      </Link>
                    </div>
                  </td>
                  <td className="mono">{patient.patientCode}</td>
                  <td>{patient.claimNumber ?? "—"}</td>
                  <td className="number">{patient.documents}</td>
                  <td className="number">{patient.openItems}</td>
                  <td>
                    {patient.latestQuery ? (
                      <span className={queryBadgeClass(patient.latestQuery)}>{patient.latestQuery}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
