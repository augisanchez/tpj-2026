"use client";

import { useState, type FormEvent } from "react";
import styles from "./SubmissionForm.module.css";

const BASIN_ENDPOINT = process.env.NEXT_PUBLIC_BASIN_ENDPOINT ?? "";

const ALLOWED_LINK_HOSTS = [
  "wetransfer.com",
  "we.tl",
  "dropbox.com",
  "drive.google.com",
  "icloud.com",
];

const MEDIUMS = ["Film", "Digital", "Mixed", "Alt-process"] as const;

type FormState = {
  name: string;
  email: string;
  instagram: string;
  title: string;
  imageCount: string;
  medium: string;
  downloadLink: string;
  intro: string;
  acknowledged: boolean;
  trap: string;
};

const INITIAL_STATE: FormState = {
  name: "",
  email: "",
  instagram: "",
  title: "",
  imageCount: "",
  medium: "",
  downloadLink: "",
  intro: "",
  acknowledged: false,
  trap: "",
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function validate(state: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!state.name.trim()) errors.name = "Please add your name.";
  if (!/^\S+@\S+\.\S+$/.test(state.email.trim()))
    errors.email = "Please add a valid email.";
  if (!state.title.trim()) errors.title = "Please add an essay title.";
  const n = Number(state.imageCount);
  if (!Number.isInteger(n) || n < 10 || n > 20)
    errors.imageCount = "Submissions must include between 10 and 20 images.";
  if (!state.medium) errors.medium = "Please choose a medium.";
  if (!state.downloadLink.trim()) {
    errors.downloadLink = "Please paste your download link.";
  } else {
    const lower = state.downloadLink.toLowerCase();
    const ok = ALLOWED_LINK_HOSTS.some((host) => lower.includes(host));
    if (!ok)
      errors.downloadLink =
        "Use a WeTransfer, Dropbox, Google Drive, or iCloud link.";
  }
  if (!state.intro.trim()) {
    errors.intro = "Please add a short intro.";
  } else if (countWords(state.intro) > 200) {
    errors.intro = "Intro is over 200 words.";
  }
  if (!state.acknowledged)
    errors.acknowledged =
      "Please confirm this is a photo essay, not a written piece.";
  return errors;
}

export function SubmissionForm() {
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setState((s) => ({ ...s, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state.trap) {
      setStatus("success");
      return;
    }

    const nextErrors = validate(state);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      const body = new FormData();
      body.set("Name", state.name);
      body.set("Email", state.email);
      body.set("Instagram or website", state.instagram);
      body.set("Essay title", state.title);
      body.set("Image count", state.imageCount);
      body.set("Medium", state.medium);
      body.set("Download link", state.downloadLink);
      body.set("Intro", state.intro);
      body.set(
        "Confirmed photo essay",
        state.acknowledged ? "yes" : "no",
      );
      body.set("_subject", `Submission: ${state.title} (${state.name})`);

      const response = await fetch(BASIN_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });

      if (!response.ok) throw new Error(`Basin responded ${response.status}`);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <section className={styles.success} role="status">
        <p className={styles.successEyebrow}>Got it</p>
        <p className={styles.successHeadline}>
          Thanks for sending your work.
        </p>
        <p className={styles.successBody}>
          We read everything that comes in. If your essay is a fit, we’ll be
          in touch with next steps, including a request for a profile picture
          and any final-resolution files. Please give us a few weeks before
          following up.
        </p>
      </section>
    );
  }

  const wordCount = countWords(state.intro);
  const overLimit = wordCount > 200;

  return (
    <form
      className={styles.form}
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="submission-form-title"
    >
      <p className={styles.eyebrow} id="submission-form-title">
        Send your essay
      </p>

      <div className={styles.row}>
        <Field
          label="Your name"
          name="name"
          value={state.name}
          onChange={(v) => update("name", v)}
          error={errors.name}
          required
        />
        <Field
          label="Email"
          name="email"
          type="email"
          value={state.email}
          onChange={(v) => update("email", v)}
          error={errors.email}
          required
        />
      </div>

      <Field
        label="Instagram or website (optional)"
        name="instagram"
        value={state.instagram}
        onChange={(v) => update("instagram", v)}
      />

      <Field
        label="Essay title"
        name="title"
        value={state.title}
        onChange={(v) => update("title", v)}
        error={errors.title}
        required
      />

      <div className={styles.row}>
        <Field
          label="Number of images (10 to 20)"
          name="imageCount"
          type="number"
          inputMode="numeric"
          min={10}
          max={20}
          value={state.imageCount}
          onChange={(v) => update("imageCount", v)}
          error={errors.imageCount}
          required
        />
        <fieldset
          className={styles.field}
          aria-describedby={errors.medium ? "medium-error" : undefined}
        >
          <legend className={styles.label}>Medium</legend>
          <div className={styles.chipGroup} role="radiogroup">
            {MEDIUMS.map((m) => (
              <label key={m} className={styles.chip}>
                <input
                  type="radio"
                  name="medium"
                  value={m}
                  checked={state.medium === m}
                  onChange={() => update("medium", m)}
                  className={styles.chipInput}
                />
                <span className={styles.chipLabel}>{m}</span>
              </label>
            ))}
          </div>
          {errors.medium && (
            <p className={styles.errorText} id="medium-error">
              {errors.medium}
            </p>
          )}
        </fieldset>
      </div>

      <Field
        label="Download link (WeTransfer, Dropbox, Google Drive, or iCloud)"
        name="downloadLink"
        type="url"
        value={state.downloadLink}
        onChange={(v) => update("downloadLink", v)}
        error={errors.downloadLink}
        helper="Make sure the link is public (no sign-in needed) and won’t expire for at least two weeks."
        required
      />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="intro">
          Intro
        </label>
        <textarea
          id="intro"
          className={styles.textarea}
          value={state.intro}
          onChange={(e) => update("intro", e.target.value)}
          aria-invalid={Boolean(errors.intro) || undefined}
          aria-describedby={errors.intro ? "intro-error" : "intro-helper"}
          rows={6}
          required
        />
        <div className={styles.helperRow}>
          <p id="intro-helper" className={styles.helperText}>
            A short introduction (max 200 words). Staff may edit lightly.
          </p>
          <p
            className={`${styles.wordCount} ${
              overLimit ? styles.wordCountOver : ""
            }`}
            aria-live="polite"
          >
            {wordCount} / 200 words
          </p>
        </div>
        {errors.intro && (
          <p className={styles.errorText} id="intro-error">
            {errors.intro}
          </p>
        )}
      </div>

      <hr className={styles.divider} />

      <div className={styles.checkboxField}>
        <input
          type="checkbox"
          id="acknowledged"
          checked={state.acknowledged}
          onChange={(e) => update("acknowledged", e.target.checked)}
          className={styles.checkbox}
          aria-invalid={Boolean(errors.acknowledged) || undefined}
          aria-describedby={
            errors.acknowledged ? "acknowledged-error" : undefined
          }
        />
        <label htmlFor="acknowledged" className={styles.checkboxLabel}>
          This is a photo essay of my own photographic work, not a written
          piece.
        </label>
      </div>
      {errors.acknowledged && (
        <p className={styles.errorText} id="acknowledged-error">
          {errors.acknowledged}
        </p>
      )}

      <input
        type="text"
        name="_gotcha"
        tabIndex={-1}
        autoComplete="off"
        value={state.trap}
        onChange={(e) => update("trap", e.target.value)}
        className={styles.honeypot}
        aria-hidden="true"
      />

      {status === "error" && (
        <p className={styles.formError} role="alert">
          Something went wrong sending your essay. Please try again, or
          email us at submissions@thephotographicjournal.com.
        </p>
      )}

      <button
        type="submit"
        className={styles.submit}
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Sending..." : "Send submission"}
      </button>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "numeric";
  min?: number;
  max?: number;
  required?: boolean;
  error?: string;
  helper?: string;
};

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  inputMode,
  min,
  max,
  required,
  error,
  helper,
}: FieldProps) {
  const errorId = error ? `${name}-error` : undefined;
  const helperId = helper ? `${name}-helper` : undefined;
  const describedBy =
    [errorId, helperId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      <input
        id={name}
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.input}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        required={required}
      />
      {helper && (
        <p id={helperId} className={styles.helperText}>
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.errorText}>
          {error}
        </p>
      )}
    </div>
  );
}
