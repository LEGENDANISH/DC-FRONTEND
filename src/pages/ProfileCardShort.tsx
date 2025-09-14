
    import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

export default function ProfileCard() {
  return (
    <div className="w-[320px] bg-[#1e1f22] rounded-xl overflow-hidden shadow-lg">
      {/* Banner */}
      <div className="h-24 bg-[#b54782] relative">
        <div className="absolute top-16 left-4">
          <Avatar className="h-20 w-20 border-4 border-[#1e1f22] rounded-full">
            <AvatarImage src="https://i.ibb.co/0jR3Htr/dbz-avatar.jpg" />
            <AvatarFallback>R</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 mt-10">
        <h2 className="text-lg font-bold">RONIT</h2>
        <p className="text-sm text-gray-400">ronit1</p>

        {/* About Me */}
        <div className="mt-4 text-sm">
          <p className="font-semibold">About Me</p>
          <p className="text-gray-300">sed 2025 for me i gues</p>
        </div>

        {/* Member Since */}
        <div className="mt-4 text-sm">
          <p className="font-semibold">Member Since</p>
          <p className="text-gray-300">12 Jul 2018</p>
        </div>

        {/* Mutual Servers */}
        <div className="mt-4 p-2 bg-[#2b2d31] rounded-md cursor-pointer">
          <p className="text-sm text-gray-300">Mutual Servers — 2</p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#2b2d31] py-2 text-center text-sm text-blue-400 cursor-pointer">
        View Full Profile
      </div>
    </div>
  );
}
