import Link from "next/link";
export default function Navbar() {
  return (
    <div className="flex justify-between items-center">
      <h1 className="text-lg font-bold">CloneDex</h1>
      <div className="flex items-center gap-4">
        <Link
          href="https://github.com/superagent-ai/vibekit"
          target="_blank"
          className="hover:opacity-45 transition-opacity duration-300"
        >
          Environments
        </Link>
      </div>
    </div>
  );
}
