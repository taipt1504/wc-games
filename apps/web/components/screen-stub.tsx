'use client';
import React from 'react';

/** Placeholder for screens not yet ported (replaced during agent fan-out). */
export function Stub({ title }: { title: string }) {
  return (
    <div className="page fade-up">
      <div className="card card-pad-lg">
        <span className="badge badge-sky">Porting in progress</span>
        <h2 className="h2 mt-12">{title}</h2>
        <p className="t2 mt-8">This screen is being ported from the GOLAZO design.</p>
      </div>
    </div>
  );
}
