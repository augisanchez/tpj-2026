"use client";

import { useState, type FormEvent } from "react";
import styles from "./SubmissionForm.module.css";

const BASIN_ENDPOINT = process.env.NEXT_PUBLIC_BASIN_CONTACT_ENDPOINT ?? "";

const TOPICS = ["Advertising", "Press", "General"] as const;

type FormState = {
  topic: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  trap: string;
};

const INITIAL_STATE: FormState = {
  topic: "",
  name: "",
  email: "",
  subject: "",
  message: "",
  trap: "",
};

function validate(state: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!state.topic) errors.topic = "Please choose a topic.";
  if (!state.name.trim()) errors.name = "Please add your name.";
  if (!/^\S+@\S+\.\S+$/.test(state.email.trim()))
    errors.email = "Please add a valid email.";
  if (!state.message.trim()) errors.message = "Please add a message.";
  return errors;
}

export function ContactForm() {
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
      body.set("Topic", state.topic);
      body.set("Name", state.name);
      body.set("Email", state.email);
      body.set("Subject", state.subject);
      body.set("Message", state.message);

      const subjectLine = state.subject.trim()
        ? `Contact [${state.topic}]: ${state.subject}`
        : `Contact [${state.topic}] from ${state.name}`;
      body.set("_subject", subjectLine);

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
          Thanks for writing.
        </p>
        <p className={styles.successBody}>
          We read everything that comes in and we’ll get back to you as
          soon as we can.
        </p>
      </section>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="contact-form-title"
    >
      <p className={styles.eyebrow} id="contact-form-title">
        Send us a message
      </p>

      <fieldset
        className={styles.field}
        aria-describedby={errors.topic ? "topic-error" : undefined}
      >
        <legend className={styles.label}>Topic</legend>
        <div className={styles.chipGroup} role="radiogroup">
          {TOPICS.map((t) => (
            <label key={t} className={styles.chip}>
              <input
                type="radio"
                name="topic"
                value={t}
                checked={state.topic === t}
                onChange={() => update("topic", t)}
                className={styles.chipInput}
              />
              <span className={styles.chipLabel}>{t}</span>
            </label>
          ))}
        </div>
        {errors.topic && (
          <p className={styles.errorText} id="topic-error">
            {errors.topic}
          </p>
        )}
      </fieldset>

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
        label="Subject (optional)"
        name="subject"
        value={state.subject}
        onChange={(v) => update("subject", v)}
      />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          className={styles.textarea}
          value={state.message}
          onChange={(e) => update("message", e.target.value)}
          aria-invalid={Boolean(errors.message) || undefined}
          aria-describedby={errors.message ? "message-error" : undefined}
          rows={8}
          required
        />
        {errors.message && (
          <p className={styles.errorText} id="message-error">
            {errors.message}
          </p>
        )}
      </div>

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
          Something went wrong sending your message. Please try again, or
          email us at info@thephotographicjournal.com.
        </p>
      )}

      <button
        type="submit"
        className={styles.submit}
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Sending..." : "Send message"}
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
  required?: boolean;
  error?: string;
};

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  error,
}: FieldProps) {
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      <input
        id={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.input}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={errorId}
        aria-required={required || undefined}
        required={required}
      />
      {error && (
        <p id={errorId} className={styles.errorText}>
          {error}
        </p>
      )}
    </div>
  );
}
