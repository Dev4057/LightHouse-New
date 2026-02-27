# Lighthouse - Advanced Snowflake Monitoring Dashboard

A modern, beautiful Next.js application for real-time Snowflake warehouse monitoring, optimization, and AI-powered insights using Cortex.

## 🌟 Features

### Dashboard & Monitoring
- **Real-time KPI tracking** - Credits used, query counts, execution times, warehouse status
- **Advanced charting** - Credits trends, warehouse distribution, query performance analysis
- **Date range selection** - Quick presets and custom date range picker
- **Responsive design** - Works seamlessly on desktop and mobile devices

### Query Analysis
- Query performance optimization
- Execution time analysis
- Expensive query identification
- Failed query tracking and triage

### Warehouse Management
- Idle cost detection
- Warehouse sizing recommendations
- Credit usage tracking
- Dormant warehouse identification
- Mixed workload detection

### Storage Analytics
- Database footprint analysis
- Stage storage tracking
- Table access patterns
- Unused/cold table detection
- Storage growth trends

### Identity & Security
- User management dashboard
- Authentication method breakdown
- MFA coverage analysis
- Access risk assessment
- RBAC visualization

### AI Insights (Cortex Integration)
- Automated optimization recommendations
- Cost savings opportunities
- Performance improvement suggestions
- Security posture analysis
- Anomaly detection

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Snowflake account with access to monitoring data
- Environment variables configured

### Installation

```bash
# Install dependencies
npm install

# Create .env.local from template
cp .env.example .env.local

# Configure your Snowflake credentials in .env.local
nano .env.local

# Start development server
npm run dev
```

Visit `http://localhost:3000` to access the dashboard.

## 📋 Environment Variables

```env
# Snowflake Configuration
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_WAREHOUSE=your_warehouse
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_SCHEMA=LIGHTHOUSE_MART
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_ROLE=your_role

# Optional: Token-based authentication
SNOWFLAKE_SESSION_TOKEN=your_token

# Cortex AI Settings  
CORTEX_MODEL=openai-gpt-5-chat
CORTEX_MODE=focused

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## 📁 Project Structure

```
src/
├── app/
│   ├── api/              # API routes for Snowflake operations
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home/Dashboard page
│   ├── globals.css       # Global styles
│   └── providers.tsx     # React providers (Query Client, etc.)
├── components/
│   ├── layout/           # Layout components (Sidebar, Header, etc.)
│   ├── dashboard/        # Dashboard-specific components
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and helpers
└── types/                # TypeScript types
```

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Data Fetching**: React Query (TanStack Query)
- **State Management**: Zustand
- **Backend**: Next.js API Routes
- **Database**: Snowflake
- **AI**: Snowflake Cortex

## 📊 Dashboard Sections

### Overview
- KPI cards with trend indicators
- Real-time status monitoring
- Quick date range selector

### Queries Tab
- Query performance trends
- Expensive query analysis
- Failed query investigation
- Slow query identification
- Query type timing analysis

### Warehouses Tab
- Credits by warehouse
- Idle cost analysis
- Warehouse sizing recommendations
- Mixed workload detection
- Capacity planning

### Storage Tab
- Database size breakdown
- Table access patterns
- Unused table detection
- Storage growth trends
- Stage analysis

### Identity & Access Tab
- User management
- MFA coverage
- Authentication failures
- Role assignments
- Privilege analysis

### AI Insights
- Cortex-powered recommendations
- Cost optimization suggestions
- Performance improvements
- Security advisories
- Anomaly alerts

## 🔄 API Routes

### `/api/health`
Health check endpoint

```bash
curl http://localhost:3000/api/health
```

### `/api/query` (Planned)
Execute SQL queries against Snowflake

### `/api/insights` (Planned)
Generate AI insights using Cortex

## 🎨 Customization

### Theming
Update color variables in `tailwind.config.ts` and `src/app/globals.css`:

```css
--primary: 29 78 216;
--primary-dark: 30 58 138;
--primary-light: 59 130 246;
```

### Adding New Pages
Create new folders in `src/app/` for additional pages:

```
src/app/
└── queries/
    └── page.tsx
```

## 📈 Performance

- Optimized bundle size (~150KB gzipped)
- Turbopack for fast development builds
- React Query for efficient data fetching
- Server-side rendering where beneficial
- Image optimization

## 🔐 Security

- Environment variables for sensitive data
- SQL injection prevention via parameterized queries
- CORS configuration for API routes
- Rate limiting (recommended)
- OAuth support for Snowflake

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions:
1. Check the existing documentation
2. Review API integration guides
3. Open an issue on GitHub

## 🗺️ Roadmap

- [ ] Real-time data streaming via WebSockets
- [ ] Custom alert configuration
- [ ] Export reports (PDF, CSV)
- [ ] Query execution from dashboard
- [ ] Custom visualization builder
- [ ] Multi-workspace support
- [ ] Advanced RBAC
- [ ] Audit logging
- [ ] Cost forecasting
- [ ] Machine learning anomaly detection

---

**Lighthouse** - Making Snowflake monitoring beautiful and insightful ✨
