/**
 * StatsCard.js — Dashboard Statistics Card
 *
 * A reusable card that displays a single stat (e.g., "Total Tasks: 5").
 * Props:
 *   - title: Label text (e.g., "Completed Tasks")
 *   - value: The number to display
 *   - icon:  An emoji icon
 *   - color: Bootstrap color class (e.g., "primary", "success", "danger")
 */

import React from 'react';

function StatsCard({ title, value, icon, color }) {
  return (
    <div className="col-6 col-md-4 col-lg-2 mb-3">
      <div className={`card text-white bg-${color} h-100 shadow-sm stats-card`}>
        <div className="card-body text-center p-3">
          <div className="fs-2 mb-1">{icon}</div>
          <div className="fs-1 fw-bold lh-1">{value}</div>
          <div className="small mt-1 opacity-75">{title}</div>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;
