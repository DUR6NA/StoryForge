import pyttsx3
import threading

class TTSEngine:
    def __init__(self):
        self.engine = None
        self.enabled = True
        try:
            self.engine = pyttsx3.init()
        except:
            print("TTS Initialization failed. Audio disabled.")
            self.enabled = False

    def speak(self, text):
        if not self.enabled or not self.engine:
            return
            
        def _speak():
            try:
                self.engine.say(text)
                self.engine.runAndWait()
            except:
                pass
                
        # Run in separate thread to not block game loop
        t = threading.Thread(target=_speak)
        t.start()

# Global instance
tts = TTSEngine()

def speak(text):
    tts.speak(text)
