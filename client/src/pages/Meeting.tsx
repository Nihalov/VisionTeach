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
import { peerConnection } from "../services/webrtc";

export default function Meeting() {

  /* ---------------- STATES ---------------- */

  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localSocketId, setLocalSocketId] = useState<string | null>(null);

  const [participants, setParticipants] = useState<
    { id: string; name: string }[]
  >([]);

  /* ---------------- REFS ---------------- */

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);

  /* ---------------- AUTH ---------------- */

  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const meetingId = "abc-defg-hij";

  /* ---------------- AUTH GUARD ---------------- */

  useEffect(() => {
    if (!isAuthenticated) navigate("/");
  }, [isAuthenticated, navigate]);

  /* ---------------- DEBUG: LOG PARTICIPANTS CHANGES ---------------- */

  useEffect(() => {
    console.log("📊 Participants updated:", participants);
  }, [participants]);

  /* ---------------- CREATE OFFER ---------------- */

  const createOffer = async () => {
    console.log("Creating offer...");
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("offer", {
      roomId: meetingId,
      offer
    });
  };

  /* ---------------- SOCKET + WEBRTC ---------------- */

  useEffect(() => {

    // Wait for socket to connect and get ID
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

    // ✅ receive existing users (filter out self)
    socket.on("existing-users", (users) => {
      console.log("Existing users:", users, "Local socket:", socket.id);
      const remoteUsers = users.filter(u => u.id !== socket.id);
      console.log("Remote users after filter:", remoteUsers);
      setParticipants(remoteUsers);
    });

    // ✅ new user joined
    socket.on("user-joined", (participant) => {
      console.log("User joined:", participant, "Local socket:", socket.id);
      // Only add if it's not us
      if (participant.id !== socket.id) {
        setParticipants(prev => [...prev, participant]);
      }
    });

    // ✅ user left
    socket.on("user-left", (id: string) => {
      console.log("User left event received. ID:", id, "Local socket:", socket.id);
      console.log("Current participants before filter:", participants);
      setParticipants(prev => {
        const updated = prev.filter(p => p.id !== id);
        console.log("Participants after filter:", updated);
        return updated;
      });
    });

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId: meetingId,
          candidate: event.candidate
        });
      }
    };

    socket.on("offer", async (data) => {
      console.log("Offer received");

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("answer", {
        roomId: meetingId,
        answer
      });
    });

    socket.on("answer", async (data) => {
      console.log("Answer received");

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
    });

    socket.on("ice-candidate", async (data) => {
      await peerConnection.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );
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

  }, [meetingId, user?.name]);

  /* ---------------- LOCAL VIDEO ---------------- */

  useEffect(() => {
    if (hasLocalVideo && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [hasLocalVideo]);

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
    peerConnection.addTrack(videoTrack, localStreamRef.current);

    setHasLocalVideo(true);
    setIsVideoOff(false);

    // create offer AFTER camera ready
    createOffer();

  }, []);

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
      peerConnection.addTrack(audioTrack, localStreamRef.current);
    }

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  /* ---------------- VIDEO TOGGLE ---------------- */

  const handleToggleVideo = () => {
    if (isVideoOff) {
      // Turn camera ON
      startVideo();
    } else {
      // Turn camera OFF
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach(track => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
      }
      setIsVideoOff(true);
      setHasLocalVideo(false);
    }
  };

  /* ---------------- LEAVE ---------------- */

  const handleLeave = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
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
              hasVideo={false}
            />
          ))}

      </div>

      {/* CONTROLS */}
      <ControlBar
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={false}
        isChatOpen={false}
        isParticipantsOpen={false}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={() => {}}
        onToggleChat={() => {}}
        onToggleParticipants={() => {}}
        onLeave={handleLeave}
      />

      <ChatPanel isOpen={false} onClose={() => {}} />
      <ParticipantsPanel isOpen={false} onClose={() => {}} />

    </div>
  );
}
