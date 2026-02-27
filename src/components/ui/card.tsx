"use client";

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className = "", ...props }: CardProps) {
  return <div className={`bg-slate-900 border border-slate-700 rounded-lg ${className}`} {...props} />;
}

export function CardHeader({ className = "", ...props }: CardProps) {
  return <div className={`p-6 border-b border-slate-700 ${className}`} {...props} />;
}

export function CardTitle({ className = "", children, ...props }: CardProps) {
  return (
    <h3 className={`text-lg font-semibold text-slate-100 ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }: CardProps) {
  return (
    <p className={`text-sm text-slate-400 mt-1 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", ...props }: CardProps) {
  return <div className={`p-6 ${className}`} {...props} />;
}
