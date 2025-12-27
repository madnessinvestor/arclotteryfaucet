import { useRef } from "react";
import somaRoletaPath from "@assets/Som_Roleta_1766809963528.mp3";
import premioEncontradoPath from "@assets/Premio_Encontrado_1766809963528.mp3";
import ganhoPath from "@assets/Ganho_1766809963528.mp3";
import perdaPath from "@assets/Perda_1766809963528.mp3";

export type AudioType = "spin" | "found" | "win" | "loss";

export function useAudio() {
  const audioRefs = useRef<Record<AudioType, HTMLAudioElement | null>>({
    spin: null,
    found: null,
    win: null,
    loss: null,
  });

  const playAudio = (type: AudioType) => {
    try {
      // Stop any currently playing audio
      Object.values(audioRefs.current).forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      });

      // Create audio element if it doesn't exist
      if (!audioRefs.current[type]) {
        const audio = new Audio();
        
        switch (type) {
          case "spin":
            audio.src = somaRoletaPath;
            break;
          case "found":
            audio.src = premioEncontradoPath;
            break;
          case "win":
            audio.src = ganhoPath;
            break;
          case "loss":
            audio.src = perdaPath;
            break;
        }
        
        audio.volume = 1;
        audioRefs.current[type] = audio;
      }

      // Play the audio
      const audio = audioRefs.current[type];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.warn(`Failed to play ${type} audio:`, err);
        });
      }
    } catch (error) {
      console.warn(`Error playing audio ${type}:`, error);
    }
  };

  return { playAudio };
}
