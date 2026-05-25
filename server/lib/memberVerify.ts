type MemberStatus = 'uye' | 'borclu' | 'degil';

type ApiResponse = {
  status: MemberStatus;
  reason?: string;
};

type VerifyResult = { status: MemberStatus; reason?: string };

/**
 * verifyMember with simple retry on 429/network errors.
 * Returns an object with `status` and optional `reason` from the TALPA API.
 */
export async function verifyMember(
  tcNo: string,
  campaignSlug?: string,
  maxRetries = 3
): Promise<VerifyResult> {
  const apiUrl = process.env.TALPA_MEMBER_API_URL ?? 'https://talpa-uye.vercel.app/api/members/verify';
  const apiKey = process.env.TALPA_API_KEY ?? '';

  const body: Record<string, string> = { tcNo };
  if (campaignSlug) body.campaignSlug = campaignSlug;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(body),
      });

      let data: ApiResponse | null = null;
      try {
        data = (await res.json()) as ApiResponse;
      } catch (e) {
        // ignore JSON parse errors
      }

      if (res.status === 401) {
        console.error('TALPA Member API: invalid API key (401)');
        return { status: 'degil', reason: data?.reason };
      }

      if (res.status === 429) {
        // rate limited — retry with exponential backoff
        const delay = Math.pow(2, attempt) * 1000; // 1s,2s,4s...
        console.warn(`TALPA Member API rate limited (429). retrying in ${delay}ms`);
        lastError = { code: 429, reason: data?.reason };
        if (attempt < maxRetries - 1) await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (res.status >= 500) {
        console.error('TALPA Member API server error', res.status, data?.reason);
        lastError = { status: res.status, reason: data?.reason };
        if (attempt < maxRetries - 1) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      // For 200/4xx responses — use API's status field if present
      if (data && data.status) {
        return { status: data.status, reason: data.reason };
      }

      // Fallback: treat non-200 without data as 'degil'
      return { status: 'degil', reason: data?.reason };
    } catch (err) {
      console.error('TALPA Member API request failed (network):', err);
      lastError = err;
      if (attempt < maxRetries - 1) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
  }

  console.error('TALPA Member API: all retries exhausted', lastError);
  return { status: 'degil', reason: typeof lastError === 'object' && lastError && 'reason' in (lastError as any) ? (lastError as any).reason : undefined };
}
