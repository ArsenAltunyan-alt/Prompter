"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CameraStatus = "requesting" | "ready" | "error";
type PanelMode = "closed" | "script" | "settings";
type FacingMode = "user" | "environment";

const DEFAULT_SCRIPT =
  "Добро пожаловать! Говорите спокойно и смотрите прямо в объектив.\n\nТекст будет плавно двигаться перед камерой - так вы сможете сохранить естественный зрительный контакт.\n\nСделайте небольшую паузу между мыслями. Улыбнитесь. Вы готовы начать запись.";

const STORAGE_KEY = "orator-teleprompter";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const promptRef = useRef<HTMLDivElement>(null);
  const promptPointerStartRef = useRef<number | null>(null);
  const recordingUrlRef = useRef<string | null>(null);

  const [cameraStatus, setCameraStatus] =
    useState<CameraStatus>("requesting");
  const [cameraMessage, setCameraMessage] = useState(
    "Разрешите доступ к камере и микрофону",
  );
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [speed, setSpeed] = useState(42);
  const [fontSize, setFontSize] = useState(34);
  const [windowHeight, setWindowHeight] = useState(220);
  const [isPromptPlaying, setIsPromptPlaying] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("closed");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [canShareRecording, setCanShareRecording] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(
    async (mode: FacingMode) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("error");
        setCameraMessage("Этот браузер не поддерживает доступ к камере");
        return;
      }

      setCameraStatus("requesting");
      setCameraMessage("Подключаем камеру…");
      stopCamera();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraStatus("ready");
        setCameraMessage("Камера готова");
      } catch (error) {
        const permissionDenied =
          error instanceof DOMException && error.name === "NotAllowedError";
        setCameraStatus("error");
        setCameraMessage(
          permissionDenied
            ? "Доступ закрыт. Разрешите камеру и микрофон в настройках браузера."
            : "Не удалось подключить камеру. Возможно, она занята другим приложением.",
        );
      }
    },
    [stopCamera],
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const preferences = JSON.parse(saved) as {
          script?: string;
          speed?: number;
          fontSize?: number;
          windowHeight?: number;
        };
        if (typeof preferences.script === "string") setScript(preferences.script);
        if (typeof preferences.speed === "number") setSpeed(preferences.speed);
        if (typeof preferences.fontSize === "number")
          setFontSize(preferences.fontSize);
        if (typeof preferences.windowHeight === "number")
          setWindowHeight(preferences.windowHeight);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    void startCamera("user");

    return () => {
      stopCamera();
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ script, speed, fontSize, windowHeight }),
    );
  }, [script, speed, fontSize, windowHeight]);

  useEffect(() => {
    if (!isPromptPlaying) return;

    const prompt = promptRef.current;
    if (!prompt) return;

    let previousTime = performance.now();
    let fractionalPixels = 0;

    const scroll = () => {
      const currentTime = performance.now();
      const delta = (currentTime - previousTime) / 1000;
      previousTime = currentTime;
      const maxScrollTop = Math.max(0, prompt.scrollHeight - prompt.clientHeight);

      if (maxScrollTop <= 1) {
        setIsPromptPlaying(false);
        return;
      }

      fractionalPixels += speed * delta;
      const pixelsToMove = Math.floor(fractionalPixels);
      if (pixelsToMove < 1) return;

      fractionalPixels -= pixelsToMove;
      prompt.scrollTop = Math.min(maxScrollTop, prompt.scrollTop + pixelsToMove);

      const reachedEnd = prompt.scrollTop >= maxScrollTop - 1;
      if (reachedEnd) {
        setIsPromptPlaying(false);
      }
    };

    const timer = window.setInterval(scroll, 40);
    return () => window.clearInterval(timer);
  }, [isPromptPlaying, speed]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(
      () => setRecordingSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.code === "Space" &&
        target?.tagName !== "TEXTAREA" &&
        target?.tagName !== "INPUT"
      ) {
        event.preventDefault();
        setIsPromptPlaying((playing) => !playing);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const resetPrompt = () => {
    if (promptRef.current) promptRef.current.scrollTop = 0;
    setIsPromptPlaying(false);
  };

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      setIsPromptPlaying(false);
      recorderRef.current.stop();
    }
  }, []);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || cameraStatus !== "ready" || !window.MediaRecorder) return;

    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
      recordingUrlRef.current = null;
      setRecordingUrl(null);
      setRecordingFile(null);
      setCanShareRecording(false);
      setShareMessage("");
    }

    const supportedType = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type));

    const recorder = new MediaRecorder(
      stream,
      supportedType ? { mimeType: supportedType } : undefined,
    );
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const recordedType = recorder.mimeType || supportedType || "video/webm";
      const extension = recordedType.toLowerCase().includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, {
        type: recordedType,
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = new File([blob], `orator-${timestamp}.${extension}`, {
        type: recordedType,
      });
      const url = URL.createObjectURL(file);
      recordingUrlRef.current = url;
      setRecordingUrl(url);
      setRecordingFile(file);
      try {
        setCanShareRecording(
          typeof navigator.share === "function" &&
            (!navigator.canShare || navigator.canShare({ files: [file] })),
        );
      } catch {
        setCanShareRecording(false);
      }
      setIsRecording(false);
      setIsPromptPlaying(false);
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    if (promptRef.current) promptRef.current.scrollTop = 0;
    setRecordingSeconds(0);
    setIsRecording(true);
    setIsPromptPlaying(true);
    setPanelMode("closed");
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const switchCamera = async () => {
    if (isRecording) stopRecording();
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  const shareRecording = async () => {
    if (!recordingFile || !canShareRecording) return;

    setShareMessage("");
    try {
      await navigator.share({
        files: [recordingFile],
        title: "Видео из суфлёра",
        text: "Запись, сделанная в приложении «Суфлёр»",
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setShareMessage("Не удалось открыть системное меню. Скачайте видео как файл.");
      }
    }
  };

  const togglePanel = (mode: Exclude<PanelMode, "closed">) => {
    setPanelMode((current) => (current === mode ? "closed" : mode));
  };

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;

  return (
    <main className={`app-shell ${panelMode !== "closed" ? "panel-open" : ""}`}>
      <div className="camera-layer" aria-hidden={cameraStatus !== "ready"}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={facingMode === "user" ? "mirrored" : ""}
        />
        <div className="camera-vignette" />
      </div>

      <section
        className="teleprompter-window"
        style={{ height: `${windowHeight}px` }}
        aria-label="Окно суфлёра"
      >
        <span className="eye-line left" aria-hidden="true" />
        <span className="eye-line right" aria-hidden="true" />
        <div
          ref={promptRef}
          className="prompt-scroll"
          onPointerDown={(event) => {
            if (event.pointerType !== "mouse") {
              promptPointerStartRef.current = event.clientY;
            }
          }}
          onPointerMove={(event) => {
            const startY = promptPointerStartRef.current;
            if (startY !== null && Math.abs(event.clientY - startY) > 6) {
              promptPointerStartRef.current = null;
              setIsPromptPlaying(false);
            }
          }}
          onPointerUp={() => {
            promptPointerStartRef.current = null;
          }}
          onPointerCancel={() => {
            promptPointerStartRef.current = null;
          }}
          onWheel={() => setIsPromptPlaying(false)}
        >
          <p
            style={{
              fontSize: `${fontSize}px`,
              paddingTop: `${Math.max(0, windowHeight / 2 - fontSize * 0.67)}px`,
              paddingBottom: `${windowHeight / 2 + 24}px`,
            }}
          >
            {script || "Введите текст сценария, чтобы начать…"}
          </p>
          <div className="prompt-end">КОНЕЦ СЦЕНАРИЯ</div>
        </div>
      </section>

      {cameraStatus !== "ready" && (
        <section className="permission-card" aria-live="polite">
          <div className="permission-icon" aria-hidden="true">
            <span />
          </div>
          <p className="eyebrow">Камера</p>
          <h1>{cameraStatus === "requesting" ? "Открываем объектив" : "Нужен доступ"}</h1>
          <p>{cameraMessage}</p>
          {cameraStatus === "error" && (
            <button type="button" className="primary-button" onClick={() => void startCamera(facingMode)}>
              Попробовать снова
            </button>
          )}
        </section>
      )}

      {isRecording && (
        <div className="recording-timer" role="status">
          <span /> REC&nbsp; {formatTime(recordingSeconds)}
        </div>
      )}

      {recordingUrl && !isRecording && (
        <section className="recording-preview" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <div className="recording-preview-card">
            <div className="preview-heading">
              <div>
                <p className="eyebrow">
                  Запись готова · {recordingFile?.type.toLowerCase().includes("mp4") ? "MP4" : "WEBM"}
                </p>
                <h2 id="preview-title">Просмотр видео</h2>
              </div>
              <button
                type="button"
                className="preview-close"
                onClick={() => setRecordingUrl(null)}
                aria-label="Закрыть просмотр"
              >
                ×
              </button>
            </div>
            <video src={recordingUrl} controls playsInline preload="metadata" />
            {shareMessage && <p className="share-message" role="status">{shareMessage}</p>}
            <div className="preview-actions">
              <button type="button" onClick={() => setRecordingUrl(null)}>
                Вернуться
              </button>
              <a className="download-button" href={recordingUrl} download={recordingFile?.name ?? "orator-video.webm"}>
                Скачать
              </a>
              {canShareRecording && (
                <button type="button" className="share-button" onClick={() => void shareRecording()}>
                  Сохранить
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="bottom-prompt-status" aria-live="polite">
        <span>{isPromptPlaying ? "Текст движется" : "Суфлёр на паузе"}</span>
        <button type="button" onClick={resetPrompt} aria-label="Вернуть текст в начало">
          ↶&nbsp; В начало
        </button>
      </div>

      <nav className="control-dock" aria-label="Управление записью и суфлёром">
        <button
          type="button"
          className={panelMode === "script" ? "dock-button active" : "dock-button"}
          onClick={() => togglePanel("script")}
          aria-label="Открыть сценарий"
        >
          <span className="dock-icon lines" aria-hidden="true">≡</span>
          <small>Сценарий</small>
        </button>

        <button
          type="button"
          className="prompt-button"
          onClick={() => setIsPromptPlaying((playing) => !playing)}
          aria-label={isPromptPlaying ? "Поставить суфлёр на паузу" : "Запустить суфлёр"}
        >
          <span aria-hidden="true">{isPromptPlaying ? "Ⅱ" : "▶"}</span>
          <small>{isPromptPlaying ? "Пауза" : "Старт"}</small>
        </button>

        <button
          type="button"
          className={isRecording ? "record-button recording" : "record-button"}
          onClick={toggleRecording}
          disabled={cameraStatus !== "ready" || typeof MediaRecorder === "undefined"}
          aria-label={isRecording ? "Остановить запись" : "Начать запись"}
        >
          <span aria-hidden="true" />
        </button>

        <button
          type="button"
          className={panelMode === "settings" ? "dock-button active" : "dock-button"}
          onClick={() => togglePanel("settings")}
          aria-label="Открыть настройки"
        >
          <span className="dock-icon sliders" aria-hidden="true">☷</span>
          <small>Настройки</small>
        </button>
      </nav>

      <aside className={`editor-panel ${panelMode !== "closed" ? "open" : ""}`} aria-hidden={panelMode === "closed"}>
        <div className="panel-handle" aria-hidden="true" />
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{panelMode === "settings" ? "Отображение" : "Ваш материал"}</p>
            <h2>{panelMode === "settings" ? "Настройки суфлёра" : "Сценарий"}</h2>
          </div>
          <button type="button" onClick={() => setPanelMode("closed")} aria-label="Закрыть панель">
            ×
          </button>
        </div>

        {panelMode === "script" && (
          <div className="script-editor">
            <label htmlFor="script-text">Текст для чтения</label>
            <textarea
              id="script-text"
              value={script}
              onChange={(event) => {
                setScript(event.target.value);
                resetPrompt();
              }}
              placeholder="Вставьте или напишите ваш текст…"
            />
            <div className="editor-meta">
              <span>{wordCount} слов</span>
              <span>Сохранено на устройстве</span>
            </div>
            <div className="editor-actions">
              <button type="button" onClick={() => setScript("")}>Очистить</button>
              <button type="button" className="primary-button" onClick={() => setPanelMode("closed")}>
                Готово
              </button>
            </div>
          </div>
        )}

        {panelMode === "settings" && (
          <div className="settings-list">
            <label className="range-setting">
              <span>
                <b>Скорость текста</b>
                <output>{(speed / 42).toFixed(1)}×</output>
              </span>
              <input
                type="range"
                min="14"
                max="98"
                step="2"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              />
              <small><i>Медленно</i><i>Быстро</i></small>
            </label>
            <label className="range-setting">
              <span>
                <b>Размер шрифта</b>
                <output>{fontSize} px</output>
              </span>
              <input
                type="range"
                min="22"
                max="64"
                step="2"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
              <small><i>Меньше</i><i>Больше</i></small>
            </label>
            <label className="range-setting">
              <span>
                <b>Высота окна</b>
                <output>{windowHeight} px</output>
              </span>
              <input
                type="range"
                min="150"
                max="380"
                step="10"
                value={windowHeight}
                onChange={(event) => setWindowHeight(Number(event.target.value))}
              />
              <small><i>Компактно</i><i>Просторно</i></small>
            </label>
            <button
              type="button"
              className="camera-switch-setting"
              onClick={() => void switchCamera()}
              disabled={cameraStatus !== "ready"}
            >
              <span aria-hidden="true">↻</span>
              <span>
                <b>Переключить камеру</b>
                <small>{facingMode === "user" ? "Сейчас фронтальная" : "Сейчас основная"}</small>
              </span>
            </button>
            <button type="button" className="reset-settings" onClick={() => {
              setSpeed(42);
              setFontSize(34);
              setWindowHeight(220);
            }}>
              ↶&nbsp; Сбросить настройки
            </button>
          </div>
        )}
      </aside>
    </main>
  );
}
