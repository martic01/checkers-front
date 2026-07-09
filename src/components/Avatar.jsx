import { getAvatarMeta } from "../game/avatars.js";
import "./Avatar.css";

export default function Avatar({ avatar, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.55 };

  if (avatar?.type === "custom" && avatar.value) {
    return (
      <div className="avatar-token avatar-token--photo" style={style}>
        <img src={avatar.value} alt="Player avatar" />
      </div>
    );
  }

  const meta = getAvatarMeta(avatar?.value);
  return (
    <div className="avatar-token" style={{ ...style, background: meta.bg }}>
      <span>{meta.emoji}</span>
    </div>
  );
}
