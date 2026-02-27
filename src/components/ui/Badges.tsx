"use client";

import React from "react";
import { AlertCircle, CheckCircle, Clock, XCircle, Pause, Filter } from "lucide-react";
import { getStatusColor, prettySlug, formatPercentage } from "@/lib/formatting";
import type { Recommendation } from "@/types";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const colors = getStatusColor(status);
  const icons: Record<string, React.ReactNode> = {
    done: <CheckCircle className="w-3 h-3" />,
    accepted: <CheckCircle className="w-3 h-3" />,
    open: <AlertCircle className="w-3 h-3" />,
    in_progress: <Clock className="w-3 h-3" />,
    snoozed: <Pause className="w-3 h-3" />,
    dismissed: <XCircle className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors.badge} ${colors.text} ${className}`}>
      {icons[status.toLowerCase().replace(/\s/g, "_")] || <Filter className="w-3 h-3" />}
      {prettySlug(status)}
    </span>
  );
}

interface PriorityBadgeProps {
  score: number;
  className?: string;
}

export function PriorityBadge({ score, className = "" }: PriorityBadgeProps) {
  let level = "Low";
  let color = "bg-slate-100 text-slate-700";

  if (score >= 45) {
    level = "Critical";
    color = "bg-red-100 text-red-700";
  } else if (score >= 30) {
    level = "High";
    color = "bg-orange-100 text-orange-700";
  } else if (score >= 20) {
    level = "Medium";
    color = "bg-yellow-100 text-yellow-700";
  } else if (score >= 10) {
    level = "Low";
    color = "bg-blue-100 text-blue-700";
  }

  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${color} ${className}`}>
      {level}
    </span>
  );
}

interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

export function ConfidenceBadge({ confidence, className = "" }: ConfidenceBadgeProps) {
  const pct = formatPercentage(confidence);

  if (confidence >= 0.8) {
    return (
      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 ${className}`}>
        ✓ {pct}
      </span>
    );
  }

  if (confidence >= 0.6) {
    return (
      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 ${className}`}>
        ~ {pct}
      </span>
    );
  }

  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 ${className}`}>
      {pct}
    </span>
  );
}

interface RecommendationCardProps {
  rec: Recommendation;
  onClick?: () => void;
  isSelected?: boolean;
}

export function RecommendationCard({ rec, onClick, isSelected = false }: RecommendationCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-slate-900 line-clamp-2">{rec.TITLE}</h3>
          <p className="text-xs text-slate-600 mt-1">{prettySlug(rec.CATEGORY)}</p>
        </div>
        <StatusBadge status={rec.CURRENT_STATUS} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <PriorityBadge score={rec.PRIORITY_SCORE} />
        <ConfidenceBadge confidence={rec.CONFIDENCE_SCORE} />
      </div>
    </div>
  );
}
