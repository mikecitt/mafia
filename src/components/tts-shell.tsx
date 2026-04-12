"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./tts-shell.module.css";

interface VoiceOption {
  label: string;
  value: string;
}

const DEFAULT_TEXT =
  "Grad spava. Mafija se budi. Izaberite metu na telefonu.";

function loadVoiceOptions() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }

  return window.speechSynthesis.getVoices().map((voice) => ({
    label: `${voice.name} (${voice.lang})`,
    value: voice.voiceURI,
  }));
}

export function TtsShell() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [rate, setRate] = useState("0.96");
  const [pitch, setPitch] = useState("1");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceUri, setVoiceUri] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const syncVoices = () => {
      const nextVoices = loadVoiceOptions();
      setVoices(nextVoices);

      if (!voiceUri) {
        const preferredVoice =
          nextVoices.find((voice) => voice.label.toLowerCase().includes("(sr")) ??
          nextVoices.find((voice) => voice.label.toLowerCase().includes("(hr")) ??
          nextVoices[0];

        setVoiceUri(preferredVoice?.value ?? "");
      }
    };

    syncVoices();
    window.speechSynthesis.addEventListener("voiceschanged", syncVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", syncVoices);
    };
  }, [voiceUri]);

  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("TTS nije podrzan u ovom browseru.");
      return;
    }

    if (!text.trim()) {
      setError("Unesi tekst za probu.");
      return;
    }

    setError(null);
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.rate = Number(rate);
    utterance.pitch = Number(pitch);

    const matchingVoice = window
      .speechSynthesis
      .getVoices()
      .find((voice) => voice.voiceURI === voiceUri);

    if (matchingVoice) {
      utterance.voice = matchingVoice;
      utterance.lang = matchingVoice.lang;
    } else {
      utterance.lang = "sr-RS";
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
  }

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <span className={styles.eyebrow}>TTS test</span>
        <h1>Probaj browser glas direktno na telefonu.</h1>
        <p>Ovde mozes da testiras tekst, brzinu i glas bez ulaska u partiju.</p>
        <div className={styles.linkRow}>
          <Link className={styles.textLink} href="/">
            Nazad na aplikaciju
          </Link>
        </div>
      </section>

      <section className={styles.panel}>
        <label className={styles.field}>
          <span>Tekst</span>
          <textarea value={text} onChange={(event) => setText(event.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Glas</span>
          <select value={voiceUri} onChange={(event) => setVoiceUri(event.target.value)}>
            {voices.length === 0 ? (
              <option value="">Default browser voice</option>
            ) : (
              voices.map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label}
                </option>
              ))
            )}
          </select>
        </label>

        <label className={styles.field}>
          <span>Brzina</span>
          <input
            type="number"
            min="0.5"
            max="1.5"
            step="0.01"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Pitch</span>
          <input
            type="number"
            min="0.5"
            max="2"
            step="0.01"
            value={pitch}
            onChange={(event) => setPitch(event.target.value)}
          />
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={speak}>
            Pusti TTS
          </button>
          <button type="button" className={styles.secondaryButton} onClick={stop}>
            Zaustavi
          </button>
        </div>

        <div className={styles.banner}>
          Safari i Chrome na telefonu cesto koriste razlicite dostupne glasove. Testiraj na istom uredjaju na kom ces voditi partiju.
        </div>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}
    </main>
  );
}
