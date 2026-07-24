import { useRef, useState } from "react";
import "./Carousel.css";

// Generic slide carousel — mirrors the app's Settings carousel: a
// horizontally swipeable, scroll-snapped track with labeled pill tabs
// above it. Swipe or tap a tab to switch slides; no arrow buttons.
export default function Carousel({ slides, className = "" }) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (slides.length === 0) return null;

  const goToSlide = (i) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
    setActiveIndex(i);
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const page = Math.round(track.scrollLeft / track.clientWidth);
    setActiveIndex(page);
  };

  return (
    <div className={`carousel ${className}`}>
      {slides.length > 1 && (
        <div className="carousel-dots">
          {slides.map((s, i) => (
            <button
              key={s.key || i}
              className={`carousel-dot ${activeIndex === i ? "carousel-dot--active" : ""}`}
              onClick={() => goToSlide(i)}
            >
              {s.label || i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="carousel-track" ref={trackRef} onScroll={handleScroll}>
        {slides.map((s, i) => (
          <div className="carousel-page" key={s.key || i}>
            {s.content}
          </div>
        ))}
      </div>
    </div>
  );
}
