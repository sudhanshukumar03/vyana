import importlib.util
from pathlib import Path


def test_environment_setup_preserves_urls_keys_and_converts_utf16(tmp_path, capsys):
    path = Path(__file__).resolve().parents[2] / "scripts/setup_env.py"
    spec = importlib.util.spec_from_file_location("setup_environment", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ROOT = tmp_path
    (tmp_path / "apps/api").mkdir(parents=True)
    (tmp_path / "ai").mkdir()
    url = "postgresql://preserved:synthetic@127.0.0.1:5433/existing"
    (tmp_path / "apps/api/.env").write_text(f"DATABASE_URL={url}\n", encoding="utf-16")
    (tmp_path / "ai/.env").write_text("GEMINI_API_KEY=synthetic-preserved-provider-key\n", encoding="utf-8")
    module.main()
    root = module.read_env(tmp_path / ".env")
    api = module.read_env(tmp_path / "apps/api/.env")
    ai = module.read_env(tmp_path / "ai/.env")
    assert root["GEMINI_API_KEY"] == ai["GEMINI_API_KEY"] == "synthetic-preserved-provider-key"
    assert api["DATABASE_URL"] == url
    assert len(root["JWT_SECRET"]) >= 32
    assert root["JWT_SECRET"] != root["AI_INTERNAL_SECRET"] == api["AI_INTERNAL_SECRET"] == ai["AI_INTERNAL_SECRET"]
    assert "synthetic-preserved" not in capsys.readouterr().out
    assert b"\x00" not in (tmp_path / "apps/api/.env").read_bytes()
    module.main()
    assert module.read_env(tmp_path / ".env") == root
