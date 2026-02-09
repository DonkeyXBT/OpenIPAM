# OpenIPAM Feature Plan

This document outlines recommended features to add to OpenIPAM, organized by priority tier. Each feature includes a rationale tied to the product's core value propositions: offline-first, zero-install, privacy-preserving IP address management and infrastructure tracking.

---

## Tier 1 — High Impact, Core IPAM Gaps

These features address the most significant functional gaps for network engineers and IT teams.

### 1. DNS Record Management

**What:** Track forward (A, AAAA, CNAME, MX, TXT, SRV) and reverse (PTR) DNS records tied to IP addresses and hosts. Provide a dedicated DNS page with per-zone views, record validation, and conflict detection (e.g., duplicate A records, missing PTR).

**Why:** DNS and IP management are tightly coupled in every real network. Engineers currently have to cross-reference a separate system. Integrating DNS records into the existing IP and host views eliminates that friction and makes OpenIPAM a single source of truth for L3 identity.

**Scope:**
- New `dns_records` table (name, type, value, TTL, zone, linked IP/host)
- Zone-based browsing (e.g., `example.com`, `10.in-addr.arpa`)
- Validation rules per record type
- Auto-suggest PTR records when assigning IPs
- Export as BIND zone file format

---

### 2. DHCP Scope Management

**What:** Model DHCP scopes (pools), track lease reservations, and visualize pool utilization alongside static IP assignments. Support scope options (gateway, DNS, lease time, domain) per pool.

**Why:** Most IPs in a subnet are DHCP-assigned. Without modeling DHCP pools, utilization metrics are incomplete — the dashboard shows free IPs that are actually in a DHCP pool. This feature makes capacity planning accurate.

**Scope:**
- New `dhcp_scopes` table (subnet, start IP, end IP, lease time, options)
- Visual pool bars inside the subnet detail view
- Distinguish static vs. DHCP-reserved vs. dynamic in IP listings
- Conflict detection: flag static IPs that fall inside a DHCP pool without a reservation
- Import/export scope definitions

---

### 3. Stale IP Detection and Reclamation

**What:** Flag IP assignments that haven't been updated or confirmed within a configurable window (e.g., 90 days). Provide a "stale IPs" report with one-click release or bulk reclamation.

**Why:** IP sprawl is the #1 operational problem in any network that's been running for more than a year. Addresses get assigned and never released. This is a low-effort, high-value feature since the `ip_history` and `audit_log` tables already capture timestamps.

**Scope:**
- Configurable staleness threshold in settings (default 90 days)
- "Stale IPs" badge on the dashboard
- Filterable column on the IP Addresses page
- Bulk-select and release workflow
- Optional "confirm assignment" reminder workflow

---

### 4. Subnet Hierarchy and Tree View

**What:** Display subnets in a hierarchical tree (supernet/subnet relationships) instead of a flat table. Automatically detect parent-child relationships based on CIDR containment.

**Why:** Real networks are hierarchically allocated (e.g., a /16 is split into /24s). The current flat list makes it hard to see how address space is structured. A tree view is the standard IPAM visualization and expected by network engineers.

**Scope:**
- Auto-compute parent-child relationships from existing CIDR data
- Collapsible tree view as an alternative to the table view
- Show aggregate utilization rolling up to parent subnets
- Drag-and-drop to re-parent subnets (updates CIDR)
- Visual breadcrumb navigation (e.g., 10.0.0.0/8 > 10.1.0.0/16 > 10.1.1.0/24)

---

## Tier 2 — Reporting, Observability, and Data Quality

These features improve decision-making and operational visibility.

### 5. Advanced Reporting and Capacity Forecasting

**What:** Add a Reports page with pre-built and custom reports: subnet utilization trends over time, IP allocation rate, hosts by type/location/company, warranty expiry timeline, and capacity forecasting (projected exhaustion date per subnet).

**Why:** The dashboard provides a point-in-time snapshot but no trends. Capacity forecasting is the single most valuable output an IPAM tool can provide — it tells you when you need to allocate more address space before it becomes an emergency.

**Scope:**
- New `utilization_snapshots` table (daily snapshots of subnet usage)
- Auto-snapshot on each database save (or configurable interval)
- Line charts for utilization trends (use Canvas API, no external libs)
- Projected exhaustion date using linear regression on snapshot data
- Pre-built reports: Top 10 utilized subnets, Hosts by type, IPs by company, Upcoming warranty expirations
- Export reports as CSV or printable HTML

---

### 6. Notification and Alert System

**What:** In-app notification center with configurable alerts for: subnet utilization thresholds (e.g., >80%), warranty/EOL expiry approaching, IP conflicts detected, stale IPs exceeding threshold, maintenance windows starting.

**Why:** Users shouldn't have to remember to check the dashboard. Proactive alerts surface problems before they become outages. Since OpenIPAM is offline-first, these are in-app notifications (no email/webhook), shown on login and in a notification bell.

**Scope:**
- New `notifications` table (type, message, severity, read/unread, created_at)
- Notification bell icon in the header with unread count badge
- Notification panel with dismiss/mark-read actions
- Configurable thresholds in Settings (utilization %, days before expiry, staleness window)
- Alert generation runs on database load and after mutations
- Severity levels: info, warning, critical

---

### 7. IP Address Scanner / Ping Sweep (Optional Online Mode)

**What:** For users who choose to enable it, provide a ping sweep function that scans a subnet and compares discovered hosts against the IPAM database. Flag unknown IPs (rogue devices) and missing IPs (registered but unreachable).

**Why:** This bridges the gap between what the IPAM database says and what's actually on the network. It's the most-requested feature in any IPAM tool. Mark it as opt-in since it requires network access and breaks the pure offline model.

**Scope:**
- Requires a lightweight local agent or WebRTC-based approach (browser can't do raw ICMP)
- Alternative: allow users to paste/import scan results (from nmap, arp-scan, etc.)
- Comparison view: "In IPAM but not on network" vs. "On network but not in IPAM"
- Last-seen timestamp per IP
- This feature could start as an import-only approach (paste nmap/arp-scan output) to stay offline-first

---

## Tier 3 — Multi-User and Collaboration

These features unlock team usage without requiring a traditional server.

### 8. Data Sync via File Export/Import (Git-Friendly)

**What:** Export the entire database as a structured JSON or SQLite file that can be committed to a Git repository, shared via file sync (Dropbox, Syncthing, NAS), or manually exchanged. Include a merge strategy for concurrent edits.

**Why:** The #1 limitation today is single-browser isolation. Teams need to share the same IPAM data. Rather than building a server, lean into the offline-first philosophy by making the data file portable and mergeable. JSON export already exists; this extends it with conflict-aware merging.

**Scope:**
- Deterministic export format (sorted keys, stable ordering) so diffs are meaningful
- Three-way merge tool: base + mine + theirs with conflict markers
- Auto-export on save to a user-specified download location (via File System Access API)
- Import with merge strategy options: "overwrite all", "keep newer", "manual resolve"
- Changelog per export (what changed since last export)

---

### 9. Role-Based Access Control (RBAC) Preparation

**What:** Add a user/role model to the database schema even in single-user mode. Track which "user" made each change (currently hardcoded to the browser). When multi-user is eventually added, the data model is ready.

**Why:** This is low-cost schema preparation that makes the audit log more useful immediately (users can set their name in settings and it appears in the audit trail). It also unblocks future multi-user features without a data migration.

**Scope:**
- New `users` table (id, name, role, created_at)
- Settings field for "current user name" (default: "local")
- Audit log entries tagged with user name
- Role definitions: admin, editor, viewer (enforced only in future multi-user mode)
- No authentication mechanism yet — just identity tracking

---

## Tier 4 — Quality of Life and Polish

Smaller features that improve daily usability.

### 10. Network Topology Visualization

**What:** Interactive network diagram showing relationships between subnets, VLANs, routers, switches, and firewalls. Auto-generate from existing data; allow manual layout adjustments.

**Why:** Topology diagrams are the universal language of network documentation. Auto-generating one from IPAM data saves hours of manual Visio/draw.io work and keeps it always up-to-date.

**Scope:**
- Canvas-based rendering (no external dependencies)
- Auto-layout using force-directed graph algorithm
- Nodes: hosts (by type icon), subnets (as clouds/boxes)
- Edges: subnet membership, VLAN associations, gateway relationships
- Click-to-navigate to detail views
- Export as PNG/SVG

---

### 11. Keyboard-Driven Quick Actions

**What:** Expand the existing keyboard shortcut system with a command palette (Ctrl+K / Cmd+K). Fuzzy search across all actions: navigate to pages, create entities, run reports, toggle settings.

**Why:** Power users live in the keyboard. A command palette is the fastest way to do anything and dramatically reduces the number of clicks for frequent operations. The global search (`/`) already exists; this extends it to actions, not just data.

**Scope:**
- Modal overlay with fuzzy search input
- Action categories: Navigation, Create, Search, Settings, Reports
- Recently used actions at the top
- Contextual actions based on current page
- Extensible action registry for future features

---

### 12. IPv6 Support

**What:** Full IPv6 address management alongside IPv4. Support IPv6 CIDR notation, address compression/expansion, and dual-stack host tracking.

**Why:** IPv6 adoption is accelerating. Any IPAM tool that only handles IPv4 will become incomplete. The subnet calculator and IP math utilities need to be extended, but the data model (text-based IP storage) already accommodates IPv6 strings.

**Scope:**
- Extend IP validation and math utilities for 128-bit addresses
- Support compressed and expanded notation (e.g., `::1` vs `0000:0000:...0001`)
- Dual-stack view: show IPv4 and IPv6 assignments per host side by side
- IPv6-specific features: EUI-64 auto-generation from MAC address, prefix delegation tracking
- Subnet calculator support for IPv6 CIDR

---

### 13. Tagging and Custom Fields

**What:** Allow users to add arbitrary key-value tags to any entity (host, IP, subnet, VLAN) and define custom fields per entity type.

**Why:** Every organization has metadata that doesn't fit the built-in schema — cost center, project code, environment (prod/staging/dev), compliance tier. Tags and custom fields let users adapt OpenIPAM to their specific needs without code changes.

**Scope:**
- New `tags` table (entity_type, entity_id, key, value)
- New `custom_field_definitions` table (entity_type, field_name, field_type, required)
- Tag pills displayed on entity rows and detail views
- Filter and search by tags
- Bulk-tag operations
- Export includes tags and custom fields

---

### 14. Printable Network Documentation

**What:** Generate formatted, printable documentation from the IPAM database: subnet allocation tables, host inventories, VLAN assignments, rack diagrams. Output as print-optimized HTML.

**Why:** Many IT teams still need printed or PDF documentation for compliance, disaster recovery binders, or handoff to contractors. Auto-generating this from live data ensures documentation is never stale.

**Scope:**
- Print-optimized CSS stylesheets
- Selectable sections (subnets only, hosts only, full inventory)
- Cover page with generation date and company info
- Table of contents with page numbers
- Rack elevation diagrams in print layout
- Browser print dialog (Ctrl+P) with clean output

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Dependencies | Recommended Order |
|---------|--------|--------|-------------|-------------------|
| Stale IP Detection | High | Low | None | 1st |
| Subnet Hierarchy Tree | High | Medium | None | 2nd |
| Notification System | High | Medium | None | 3rd |
| DNS Record Management | High | Medium | None | 4th |
| DHCP Scope Management | High | Medium | DNS (optional) | 5th |
| Tagging & Custom Fields | Medium | Medium | None | 6th |
| Advanced Reporting | High | High | Snapshots infrastructure | 7th |
| Command Palette | Medium | Low | None | 8th |
| Data Sync / Merge | High | High | Deterministic export | 9th |
| IPv6 Support | Medium | High | IP math rewrite | 10th |
| Network Topology Viz | Medium | High | Canvas rendering | 11th |
| Printable Documentation | Medium | Medium | None | 12th |
| IP Scanner (import-based) | Medium | Low | None | 13th |
| RBAC Preparation | Low | Low | None | 14th |

---

## Guiding Principles

1. **Stay offline-first.** Every feature must work without a network connection. Online-optional features (like ping sweep) should be clearly marked and never required.
2. **No external dependencies.** Continue the zero-dependency philosophy. Use Canvas API for charts/diagrams, not D3 or Chart.js.
3. **Data model first.** Get the schema right before building UI. Migrations should be non-destructive and automatic.
4. **Progressive complexity.** Default views should stay simple. Advanced features (reporting, topology) should be discoverable but not in the way.
5. **Backward compatibility.** Existing JSON backups must always import cleanly into newer versions.
