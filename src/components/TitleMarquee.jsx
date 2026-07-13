import { useEffect, useRef, useState } from "react";
import "./TitleMarquee.css";

export default function TitleMarquee({ title }) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (!wrapRef.current || !textRef.current) return;
    setOverflowing(textRef.current.scrollWidth > wrapRef.current.clientWidth);
  }, [title]);

  if (!title) return null;

  return (
    <span className="title-marquee" ref={wrapRef}>
      <span className={`title-marquee__text ${overflowing ? "title-marquee__text--scroll" : ""}`} ref={textRef}>
        {title}
      </span>
    </span>
  );
}
