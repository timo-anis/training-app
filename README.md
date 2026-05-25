# 🧠 Timo Training

A focused, mobile-first training app for real workout use.

Built as a lightweight PWA with a calm, practical UX: fast logging during training, reliable local handling on-device, and optional Supabase-backed cloud sync for signed-in users.

---

## Repository Tracks

This repo currently contains **two separate product tracks** plus a
stabilization documentation track.

### 1. MVP1 / current working app

This is the current production-like working solution.

- Source of truth is the current working [`index.html`](./index.html)
- This is the active app behavior baseline
- Bug fixes and narrow UX patches should assume MVP1 unless explicitly
  told otherwise
- MVP1 must not be migrated or refactored into V2 implicitly

### 2. V2 architecture scaffold

This is a separate architecture base for future development.

- It is **not** the active app
- It is **not** the current production baseline
- It must not be treated as the implementation source of truth
- It exists to guide future clean architecture work beside MVP1

See:

- [Repo Tracks Overview](./docs:/REPO_TRACKS.md)
- [V2 Architecture Blueprint](./docs:/V2_ARCHITECTURE.md)

### 3. Pre-v2 stabilization documents

These docs define what MVP1 must stabilize before V2 becomes practical.

See:

- [Pre-V2 Stabilization Plan](./docs:/PRE_V2_STABILIZATION.md)
- [Pre-V2 Stabilization Checklist](./docs:/PRE_V2_STABILIZATION_CHECKLIST.md)
- [Current Baseline](./CURRENT_BASELINE.md)

Until an explicit switch is made, **MVP1 remains the source of truth**.

---

## 🚀 Live

https://mullemeeldibtrenniteha2026.github.io/training-app/

---

## ✨ Current App Features

- Auth-first sign-in flow for cloud users
- User-scoped 4-digit PIN on each device after sign-in
- Signed-in scoped workout state and UI selection
- Supabase cloud sync for signed-in users
- Local fallback and local-only mode when signed out or offline
- Empty cloud overwrite protection for safer persistence
- Automatic local snapshot backups before risky writes
- Restore flow for local snapshots on the same device
- Clean new-user calendar state without inherited default markers
- First-workout CTA for signed-in users with an empty training state
- Mobile-first workout execution with sets, reps, weights, and timer
- Muscle balance radar (Day / Week / Lifetime)
- Installable as a mobile app (PWA)

---

## 🎯 Design Principles

- Clarity over complexity  
- Speed over features  
- Focus over noise  
- Safe state handling over clever shortcuts

Designed to reduce friction during workouts while keeping user data predictable and isolated.

---

## 🧩 Tech Stack

- HTML / CSS / JavaScript  
- Supabase  
- GitHub Pages  
- PWA (manifest + icons)

---

## 🧠 Current Product Story

Most training apps are overloaded, slow, or unclear when you actually try to use them in the middle of a workout.

This app is being shaped around a narrower goal:

**Open fast, understand your state immediately, and train without losing data or flow.**

The current baseline prioritizes:
- reliable auth-first access for signed-in users
- calm cloud/local state handling
- mobile-friendly workout execution
- safe recovery paths through local snapshots and guarded cloud writes

---

## 🔄 Next Focus

- Smoother new-user onboarding after first sign-in
- Continued cloud/local safety hardening
- Small usability improvements around workout execution
- Cleanup only after the current baseline remains stable

---

## 👤 Author

**Timo Anis**  
Product Lead

---

## V2 Architecture

This project is evolving into a V2 version with a clean, long-term architecture.

The goal is to build a reliable, scalable training system with:
- clear domain model (workouts, exercises, sets)
- strict data integrity
- separated layers (domain, state, UI, services)
- predictable behavior in real workout usage

👉 Full architecture blueprint:
[docs:/V2_ARCHITECTURE.md](./docs:/V2_ARCHITECTURE.md)
