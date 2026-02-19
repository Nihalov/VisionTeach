import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import VideoTile from "@/components/VideoTile";
import ChatPanel from "@/components/ChatPanel";
import ParticipantsPanel from "@/components/ParticipantsPanel";
import ControlBar from "@/components/ControlBar";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { socket } from "../services/socket";
import { createPeerConnection } from "../services/webrtc";

export default function Meeting() {

  /* ---------------- STATES ---------------- */

  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [copied, setCopied] = useState(false);
  const [localSocketId, setLocalSocketId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([]);

  /* ---------------- REFS ---------------- */

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Store the active RTCPeerConnection in a ref so it's accessible everywhere
  // without triggering re-renders, and so we can close/replace it cleanly.
  const pcRef = useRef<RTCPeerConnection | null>(null);

  /* ---------------- AUTH ---------------- */

  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const meetingId = "abc-defg-hij";

  /* ---------------- AUTH GUARD ---------------- */

  useEffect(() => {
    if (!isAuthenticated) navigate("/");
  }, [isAuthenticated, navigate]);

  /* ---------------- HELPERS ---------------- */

  /**
   * Create (or recreate) a fresh RTCPeerConnection, wiring all the callbacks.
   * If there is an old connection it is closed first.
   */
  const initPC = useCallback(() => {
    // Close existing connection cleanly before creating a new one
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.close();
    }

    const pc = createPeerConnection();
    pcRef.current = pc;

    // Deliver any existing local tracks to the new connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      console.log("ontrack fired, got stream", event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId: meetingId,
          candidate: event.candidate
        });
      }
    };

    // Log connection state changes for easy debugging
    pc.onconnectionstatechange = () => {
      console.log("PeerConnection state:", pc.connectionState);
    };

    return pc;
  }, [meetingId]);

  /**
   * Build an offer on the current (or a freshly created) connection and
   * broadcast it to the room.
   */
  const sendOffer = useCallback(async (pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { roomId: meetingId, offer });
      console.log("Offer sent");
    } catch (err) {
      console.error("sendOffer failed:", err);
    }
  }, [meetingId]);

  /* ---------------- SOCKET + WEBRTC EVENTS ---------------- */

  useEffect(() => {

    const handleConnect = () => {
      console.log("Socket connected with ID:", socket.id);
      setLocalSocketId(socket.id);
      socket.emit("join-room", {
        roomId: meetingId,
        user: { name: user?.name || "Guest" }
      });
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on("connect", handleConnect);
    }

    // Receive existing users (filter out self)
    socket.on("existing-users", (users: { id: string; name: string }[]) => {
      console.log("Existing users:", users);
      setParticipants(users.filter(u => u.id !== socket.id));
    });

    // A new peer has joined — add to list and, if we already have video running,
    // send them an offer so they can see us without a page refresh.
    socket.on("user-joined", (participant: { id: string; name: string }) => {
      console.log("User joined:", participant);
      if (participant.id === socket.id) return;

      setParticipants(prev => {
        // Prevent duplicates
        if (prev.find(p => p.id === participant.id)) return prev;
        return [...prev, participant];
      });

      // If we are already streaming, initiate a fresh negotiation so the new
      // peer receives our video immediately.
      if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
        console.log("New peer joined while we have media — sending offer");
        const pc = initPC();
        sendOffer(pc);
      }
    });

    // User left
    socket.on("user-left", (id: string) => {
      console.log("User left:", id);
      setParticipants(prev => prev.filter(p => p.id !== id));
      // If that peer was streaming to us, clear the remote stream
      setRemoteStream(null);
    });

    // ---- Signalling ----

    socket.on("offer", async (data: { offer: RTCSessionDescriptionInit }) => {
      console.log("Offer received — creating answer");
      const pc = initPC();          // fresh connection per offer

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", { roomId: meetingId, answer });
    });

    socket.on("answer", async (data: { answer: RTCSessionDescriptionInit }) => {
      console.log("Answer received");
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        console.error("setRemoteDescription (answer) failed:", err);
      }
    });

    socket.on("ice-candidate", async (data: { candidate: RTCIceCandidateInit }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn("addIceCandidate failed:", err);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("existing-users");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, [meetingId, user?.name, initPC, sendOffer]);

  /* ---- Attach remote stream to video element when either changes ---- */

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  /* ---- Attach local stream to video element when video turns on ---- */

  useEffect(() => {
    if (hasLocalVideo && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [hasLocalVideo]);

  /* ---------------- VIDEO TOGGLE ---------------- */

  const startVideo = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    const videoTrack = stream.getVideoTracks()[0];

    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    localStreamRef.current.addTrack(videoTrack);

    // Always start with a fresh peer connection so we never hit "invalid state"
    const pc = initPC(); // this also delivers the track to the connection
    // initPC re-adds tracks from localStreamRef — but we just added the video
    // track there, so it's included. No need to addTrack again.

    setHasLocalVideo(true);
    setIsVideoOff(false);

    // Send offer AFTER the track is in the connection
    await sendOffer(pc);
  }, [initPC, sendOffer]);

  const handleToggleVideo = () => {
    if (isVideoOff) {
      startVideo();
    } else {
      // Turn camera OFF — stop tracks and remove from stream
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
      }
      setIsVideoOff(true);
      setHasLocalVideo(false);

      // Close the connection; the remote peer will receive user-left or can
      // detect the track ending via ontrack/removetrack on their side.
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    }
  };

  /* ---------------- MUTE ---------------- */

  const handleToggleMute = async () => {
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    let audioTrack = localStreamRef.current.getAudioTracks()[0];

    if (!audioTrack) {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioTrack = audioStream.getAudioTracks()[0];
      localStreamRef.current.addTrack(audioTrack);
      pcRef.current?.addTrack(audioTrack, localStreamRef.current);
    }

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  /* ---------------- LEAVE ---------------- */

  const handleLeave = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    socket.disconnect();
    navigate("/home");
  };

  /* ---------------- COPY ---------------- */

  const handleCopyMeetingId = () => {
    navigator.clipboard.writeText(meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="h-screen flex flex-col bg-background">

      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">GestureLearn</h1>

          <Shield className="w-4 h-4" />
          <code>{meetingId}</code>

          <Button size="icon" onClick={handleCopyMeetingId}>
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>

        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          {user?.name?.charAt(0) || "U"}
        </div>
      </header>

      {/* VIDEO GRID */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">

        {/* LOCAL */}
        <VideoTile
          name={user?.name || "You"}
          isMuted={isMuted}
          isLocal
          videoRef={localVideoRef}
          hasVideo={hasLocalVideo}
        />

        {/* REMOTES */}
        {participants
          .filter(p => p.id !== localSocketId)
          .map(p => (
            <VideoTile
              key={p.id}
              name={p.name}
              isMuted={true}
              isLocal={false}
              mirror={true}
              hasVideo={!!remoteStream}
              videoRef={remoteVideoRef}
            />
          ))}

      </div>

      {/* CONTROLS */}
      <ControlBar
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={false}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={() => { }}
        onToggleChat={() => setIsChatOpen(v => !v)}
        onToggleParticipants={() => setIsParticipantsOpen(v => !v)}
        onLeave={handleLeave}
      />

      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <ParticipantsPanel isOpen={isParticipantsOpen} onClose={() => setIsParticipantsOpen(false)} />

    </div>
  );
}
