use super::*;
use std::time::{SystemTime, UNIX_EPOCH};

fn fresh(label: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let p = std::env::temp_dir().join(format!("solomd-crypto-{label}-{nanos}"));
    let _ = fs::remove_dir_all(&p);
    fs::create_dir_all(&p).unwrap();
    p
}

fn fixed_key() -> [u8; 32] {
    let mut k = [0u8; 32];
    for (i, b) in k.iter_mut().enumerate() {
        *b = (i * 7) as u8;
    }
    k
}

#[test]
fn round_trip_short() {
    let key = fixed_key();
    let blob = encrypt_bytes(&key, "notes/foo.md", b"hello world").unwrap();
    let back = decrypt_bytes(&key, "notes/foo.md", &blob).unwrap();
    assert_eq!(back, b"hello world");
}

#[test]
fn round_trip_unicode_and_long() {
    let key = fixed_key();
    let pt: Vec<u8> = (0..4096).map(|i| (i % 251) as u8).collect();
    let blob = encrypt_bytes(&key, "deep/path/x.md", &pt).unwrap();
    let back = decrypt_bytes(&key, "deep/path/x.md", &blob).unwrap();
    assert_eq!(back, pt);

    let utf8 = "中文标题\n# Hello 🌏\n— em-dash";
    let blob2 = encrypt_bytes(&key, "中文/note.md", utf8.as_bytes()).unwrap();
    let back2 = decrypt_bytes(&key, "中文/note.md", &blob2).unwrap();
    assert_eq!(back2, utf8.as_bytes());
}

#[test]
fn aad_path_swap_fails() {
    let key = fixed_key();
    let blob = encrypt_bytes(&key, "secret.md", b"top secret").unwrap();
    let res = decrypt_bytes(&key, "boring.md", &blob);
    assert!(res.is_err(), "AAD mismatch must reject");
}

#[test]
fn wrong_key_fails() {
    let blob = encrypt_bytes(&fixed_key(), "x.md", b"abc").unwrap();
    let mut bad = fixed_key();
    bad[0] ^= 1;
    assert!(decrypt_bytes(&bad, "x.md", &blob).is_err());
}

#[test]
fn tampered_ciphertext_fails() {
    let key = fixed_key();
    let mut blob = encrypt_bytes(&key, "x.md", b"abcdef").unwrap();
    let last = blob.len() - 1;
    blob[last] ^= 0x01;
    assert!(decrypt_bytes(&key, "x.md", &blob).is_err());
}

#[test]
fn argon2_derives_deterministically() {
    let salt = vec![1u8; 16];
    let p = KdfParams::default();
    let k1 = derive_key("hunter2", &salt, &p).unwrap();
    let k2 = derive_key("hunter2", &salt, &p).unwrap();
    assert_eq!(k1, k2);
    let k3 = derive_key("hunter3", &salt, &p).unwrap();
    assert_ne!(k1, k3);
}

#[test]
fn workspace_round_trip() {
    let ws = fresh("ws");
    // Layout: notes/a.md (encrypted), assets/img.png (mirrored as-is),
    // .solomd/sync.json (skipped — workspace metadata never enters
    // the shadow).
    fs::create_dir_all(ws.join("notes")).unwrap();
    fs::create_dir_all(ws.join("assets")).unwrap();
    fs::create_dir_all(ws.join(".solomd")).unwrap();
    fs::write(ws.join("notes/a.md"), b"# Hello").unwrap();
    fs::write(ws.join("assets/img.png"), b"\x89PNG fake").unwrap();
    fs::write(ws.join(".solomd/sync.json"), b"{}").unwrap();

    let folder = ws.to_string_lossy().to_string();
    crypto_set_passphrase(folder.clone(), "hunter2".into()).unwrap();
    let shadow = crypto_encrypt_for_push_inner(folder.clone()).unwrap();
    let shadow_dir = PathBuf::from(&shadow);
    assert!(shadow_dir.join("notes/a.md.enc").exists());
    assert!(shadow_dir.join("assets/img.png").exists());
    assert!(!shadow_dir.join(".solomd/sync.json").exists());

    // Wipe the plaintext to simulate a fresh device, then decrypt
    // back from the shadow.
    fs::remove_file(ws.join("notes/a.md")).unwrap();
    crypto_decrypt_after_pull_inner(folder.clone()).unwrap();
    let restored = fs::read(ws.join("notes/a.md")).unwrap();
    assert_eq!(restored, b"# Hello");
}

#[test]
fn second_set_passphrase_with_wrong_word_fails() {
    let ws = fresh("ws-pp");
    let folder = ws.to_string_lossy().to_string();
    crypto_set_passphrase(folder.clone(), "correct".into()).unwrap();
    let bad = crypto_set_passphrase(folder, "guess".into());
    assert!(bad.is_err());
    let _ = crypto_clear_passphrase(ws.to_string_lossy().to_string());
}
