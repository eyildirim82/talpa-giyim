// Görselleri Supabase Storage'a yüklemeden önce tarayıcıda yeniden
// boyutlandırıp sıkıştırır. Böylece `campaign-images` bucket'ının dosya boyutu
// limiti (5MB) aşılmaz ve üye tarafındaki sayfalar daha hızlı yüklenir.

interface CompressOptions {
  /** Genişlik veya yükseklikten büyük olanın hedef üst sınırı (px). */
  maxDimension?: number;
  /** Kayıplı formatlar (JPEG/WebP) için başlangıç kalitesi (0–1). */
  quality?: number;
  /** Hedef üst boyut (byte). Bucket limitinin biraz altında tutulur. */
  maxBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.82,
  // Bucket limiti 5 MB; güvenlik payı bırakmak için 4.5 MB hedefliyoruz.
  maxBytes: 4_500_000,
};

// Canvas ile yeniden kodlanmaması gereken türler:
// - SVG: vektör; rasterize etmek bozar (ve zaten küçüktür)
// - GIF: animasyonlu olabilir; canvas tek kareye düşürür
const SKIP_TYPES = new Set(['image/svg+xml', 'image/gif']);

interface LoadedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // Bazı tarayıcılar/biçimler createImageBitmap'i desteklemez → <img>'e düş.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Görsel çözümlenemedi'));
      el.src = url;
    });
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function draw(
  src: LoadedImage,
  w: number,
  h: number,
  type: string,
  quality: number,
  whiteBackground: boolean,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  if (whiteBackground) {
    // JPEG saydamlığı desteklemez; saydam alanlar varsayılan siyah yerine beyaz olsun.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(src.image, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

function swapExt(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot === -1 ? name : name.slice(0, dot);
  return `${base}.${ext}`;
}

function toFile(blob: Blob, originalName: string): File {
  const ext =
    blob.type === 'image/jpeg' ? 'jpg' :
    blob.type === 'image/png' ? 'png' :
    blob.type === 'image/webp' ? 'webp' : null;
  const name = ext ? swapExt(originalName, ext) : originalName;
  return new File([blob], name, { type: blob.type });
}

/**
 * Görseli yüklemeye uygun boyuta indirir. Mümkünse orijinal formatı (ve
 * saydamlığı) korur; limiti aşarsa beyaz arka planlı JPEG'e düşürür.
 * Küçültmeye gerek yoksa orijinal dosyayı olduğu gibi döndürür.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  // Vektör/animasyonlu türleri olduğu gibi bırak.
  if (SKIP_TYPES.has(file.type)) return file;

  let src: LoadedImage;
  try {
    src = await loadImage(file);
  } catch {
    // Çözümlenemiyorsa dokunma; yükleme akışı kendi hatasını üretsin.
    return file;
  }

  try {
    const scale = Math.min(1, opts.maxDimension / Math.max(src.width, src.height));

    // Hem boyut hem ölçü uygunsa yeniden kodlama yapma (gereksiz kalite kaybı olmasın).
    if (scale === 1 && file.size <= opts.maxBytes) return file;

    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const mayHaveAlpha = file.type === 'image/png' || file.type === 'image/webp';

    // 1) Saydamlık taşıyabilen formatlarda önce orijinal formatı korumayı dene.
    if (mayHaveAlpha) {
      const blob = await draw(src, w, h, file.type, opts.quality, false);
      if (blob && blob.size <= opts.maxBytes) {
        return blob.size < file.size ? toFile(blob, file.name) : file;
      }
    }

    // 2) JPEG'e düş: beyaz arka plan + sığana kadar kaliteyi düşür.
    let q = opts.quality;
    let blob = await draw(src, w, h, 'image/jpeg', q, true);
    while (blob && blob.size > opts.maxBytes && q > 0.4) {
      q = Math.round((q - 0.1) * 100) / 100;
      blob = await draw(src, w, h, 'image/jpeg', q, true);
    }

    if (!blob) return file; // canvas desteklenmiyor → orijinali dene
    // Sonuç orijinalden büyük ve orijinal zaten limit altındaysa orijinali tut.
    if (blob.size >= file.size && file.size <= opts.maxBytes) return file;
    return toFile(blob, file.name);
  } finally {
    src.close();
  }
}
