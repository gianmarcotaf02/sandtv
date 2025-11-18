/**
 * Content Type Detection System
 * Auto-riconosce se un canale è LIVE, ON_DEMAND, VOD, o CATCHUP
 * Analizza: EPG, naming patterns, URL patterns, group-title, e metadata
 */

export enum ContentType {
  LIVE = 'live',           // TV lineare in diretta
  ON_DEMAND = 'on-demand', // Film/serie/contenuto a richiesta
  VOD = 'vod',             // Video on demand (generico)
  CATCHUP = 'catchup',     // Replay/archivio TV (ultimi 7 giorni)
  UNKNOWN = 'unknown',     // Non classificabile
}

export interface ContentDetectionResult {
  contentType: ContentType;
  confidence: number;         // 0-1, confidenza del riconoscimento
  reasons: string[];         // Spiegazione del riconoscimento
  detectedVia: 'epg' | 'naming' | 'url' | 'metadata' | 'default';
}

/**
 * Pattern di riconoscimento per LIVE
 */
const LIVE_INDICATORS = {
  // Keyword nel nome che indicano live
  namePatterns: [
    /\blive\b/i,
    /\btvg-name.*TV\b/i,
    /^(rai|mediaset|sky|dazn|netflix)[\s\d]?/i,
    /\b(news|tg|giornale|telegiallo|telebomba)\b/i,
    /\bchannel\b/i,
    /\bstream\b/i,
  ],
  // Keyword nel group-title che indicano live
  groupPatterns: [
    /^TV$/i,
    /^Canali TV$/i,
    /^Television$/i,
    /^Live/i,
  ],
  // Pattern negli URL che indicano live streaming
  urlPatterns: [
    /hls/i,
    /mpd/i,
    /m3u/i,
    /\.ts\b/i,
    /live/i,
    /stream/i,
    /broadcast/i,
  ],
};

/**
 * Pattern di riconoscimento per ON_DEMAND/VOD
 */
const ONDEMAND_INDICATORS = {
  // Keyword nel nome che indicano on-demand
  namePatterns: [
    /\b(film|movie|serie|series|show|episod|stagion)\b/i,
    /\b(netflix|amazon|disney|primevideo)\b/i,
    /\b(documentari|documentary|concert|live concert|sport|calcio|calcetto)\b/i,
  ],
  // Keyword nel group-title che indicano on-demand
  groupPatterns: [
    /^Film$/i,
    /^Serie TV$/i,
    /^Documentari$/i,
    /^Sport$/i,
    /^Concerti$/i,
    /^On Demand$/i,
    /^VOD$/i,
  ],
  // Pattern negli URL che indicano VOD
  urlPatterns: [
    /mp4/i,
    /\.mp4\b/i,
    /\.mkv\b/i,
    /\.mov\b/i,
    /vod/i,
    /on-demand/i,
    /ondemand/i,
    /download/i,
    /progressive/i,
  ],
};

/**
 * Pattern di riconoscimento per CATCHUP
 */
const CATCHUP_INDICATORS = {
  namePatterns: [
    /\b(replay|catchup|catch-up|archivio|riplay)\b/i,
    /\b\+\d+\b/, // +1 ore, +2 ore, etc.
    /\b\d+\s*(ore|hours|day|giorni|days)\s*back\b/i,
  ],
  groupPatterns: [
    /^Replay$/i,
    /^Catchup$/i,
    /^Archivio$/i,
  ],
  urlPatterns: [],
};

/**
 * Analizza EPG per riconoscere content type
 * Se c'è EPG data, è probabilmente LIVE
 */
function analyzeEpgData(epgUrl?: string, hasEpgData?: boolean): ContentDetectionResult | null {
  if (!epgUrl && !hasEpgData) {
    return null;
  }

  // EPG presence è forte indicatore di live
  return {
    contentType: ContentType.LIVE,
    confidence: 0.8,
    reasons: ['EPG data presente - indicatore di canale live'],
    detectedVia: 'epg',
  };
}

/**
 * Analizza il nome del canale/contenuto
 */
function analyzeChannelName(name: string): ContentDetectionResult | null {
  if (!name) return null;

  const nameLower = name.toLowerCase();

  // Check LIVE patterns
  for (const pattern of LIVE_INDICATORS.namePatterns) {
    if (pattern.test(name)) {
      return {
        contentType: ContentType.LIVE,
        confidence: 0.7,
        reasons: [`Nome contiene pattern live: "${name}"`],
        detectedVia: 'naming',
      };
    }
  }

  // Check ON_DEMAND patterns
  for (const pattern of ONDEMAND_INDICATORS.namePatterns) {
    if (pattern.test(name)) {
      return {
        contentType: ContentType.ON_DEMAND,
        confidence: 0.75,
        reasons: [`Nome contiene pattern on-demand: "${name}"`],
        detectedVia: 'naming',
      };
    }
  }

  // Check CATCHUP patterns
  for (const pattern of CATCHUP_INDICATORS.namePatterns) {
    if (pattern.test(name)) {
      return {
        contentType: ContentType.CATCHUP,
        confidence: 0.8,
        reasons: [`Nome contiene pattern catchup/replay: "${name}"`],
        detectedVia: 'naming',
      };
    }
  }

  return null;
}

/**
 * Analizza il group-title
 */
function analyzeGroupTitle(groupTitle?: string): ContentDetectionResult | null {
  if (!groupTitle) return null;

  // Check LIVE patterns
  for (const pattern of LIVE_INDICATORS.groupPatterns) {
    if (pattern.test(groupTitle)) {
      return {
        contentType: ContentType.LIVE,
        confidence: 0.85,
        reasons: [`Group title indica live: "${groupTitle}"`],
        detectedVia: 'metadata',
      };
    }
  }

  // Check ON_DEMAND patterns
  for (const pattern of ONDEMAND_INDICATORS.groupPatterns) {
    if (pattern.test(groupTitle)) {
      return {
        contentType: ContentType.ON_DEMAND,
        confidence: 0.9,
        reasons: [`Group title indica on-demand: "${groupTitle}"`],
        detectedVia: 'metadata',
      };
    }
  }

  // Check CATCHUP patterns
  for (const pattern of CATCHUP_INDICATORS.groupPatterns) {
    if (pattern.test(groupTitle)) {
      return {
        contentType: ContentType.CATCHUP,
        confidence: 0.85,
        reasons: [`Group title indica catchup: "${groupTitle}"`],
        detectedVia: 'metadata',
      };
    }
  }

  return null;
}

/**
 * Analizza l'URL dello stream
 */
function analyzeStreamUrl(url: string): ContentDetectionResult | null {
  if (!url) return null;

  const urlLower = url.toLowerCase();

  // Check LIVE patterns
  for (const pattern of LIVE_INDICATORS.urlPatterns) {
    if (pattern.test(url)) {
      return {
        contentType: ContentType.LIVE,
        confidence: 0.6,
        reasons: [`URL contiene pattern live streaming: "${url}"`],
        detectedVia: 'url',
      };
    }
  }

  // Check ON_DEMAND patterns
  for (const pattern of ONDEMAND_INDICATORS.urlPatterns) {
    if (pattern.test(url)) {
      return {
        contentType: ContentType.ON_DEMAND,
        confidence: 0.65,
        reasons: [`URL contiene pattern video on demand: "${url}"`],
        detectedVia: 'url',
      };
    }
  }

  return null;
}

/**
 * Determina il content type basandosi su TVG ID
 * Alcuni pattern comuni nei tvg-id indicano contenuto live
 */
function analyzeTvgId(tvgId?: string): ContentDetectionResult | null {
  if (!tvgId) return null;

  const tvgLower = tvgId.toLowerCase();

  // Provider live comuni
  if (
    tvgLower.includes('rai') ||
    tvgLower.includes('mediaset') ||
    tvgLower.includes('sky') ||
    tvgLower.includes('dazn') ||
    tvgLower.includes('timvision')
  ) {
    return {
      contentType: ContentType.LIVE,
      confidence: 0.75,
      reasons: [`TVG ID contiene provider live noto: "${tvgId}"`],
      detectedVia: 'metadata',
    };
  }

  // Provider VOD comuni
  if (
    tvgLower.includes('netflix') ||
    tvgLower.includes('amazon') ||
    tvgLower.includes('disney') ||
    tvgLower.includes('primevideo')
  ) {
    return {
      contentType: ContentType.ON_DEMAND,
      confidence: 0.8,
      reasons: [`TVG ID contiene provider VOD noto: "${tvgId}"`],
      detectedVia: 'metadata',
    };
  }

  return null;
}

/**
 * Riconosce automaticamente il content type
 * Applica una strategia di weighted scoring combinando più segnali
 */
export function detectContentType(options: {
  channelName: string;
  groupTitle?: string;
  url: string;
  tvgId?: string;
  epgUrl?: string;
  hasEpgData?: boolean;
}): ContentDetectionResult {
  const results: ContentDetectionResult[] = [];

  // Analisi EPG (priorità alta)
  const epgResult = analyzeEpgData(options.epgUrl, options.hasEpgData);
  if (epgResult) results.push(epgResult);

  // Analisi Group Title (priorità alta - è quasi sempre accurato)
  const groupResult = analyzeGroupTitle(options.groupTitle);
  if (groupResult) results.push(groupResult);

  // Analisi TVG ID (priorità media)
  const tvgResult = analyzeTvgId(options.tvgId);
  if (tvgResult) results.push(tvgResult);

  // Analisi Nome Canale (priorità media)
  const nameResult = analyzeChannelName(options.channelName);
  if (nameResult) results.push(nameResult);

  // Analisi URL (priorità bassa - meno affidabile)
  const urlResult = analyzeStreamUrl(options.url);
  if (urlResult) results.push(urlResult);

  // Se abbiamo risultati, calcola il tipo più probabile
  if (results.length > 0) {
    // Calcola score medio per ogni content type
    const typeScores = new Map<ContentType, { score: number; count: number; reasons: string[] }>();

    for (const result of results) {
      const current = typeScores.get(result.contentType) || { score: 0, count: 0, reasons: [] };
      current.score += result.confidence;
      current.count += 1;
      current.reasons.push(...result.reasons);
      typeScores.set(result.contentType, current);
    }

    // Trova il tipo con score migliore
    let bestType = ContentType.UNKNOWN;
    let bestScore = 0;
    let bestReasons: string[] = [];

    for (const [type, data] of typeScores.entries()) {
      const avgScore = data.score / data.count;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestType = type;
        bestReasons = data.reasons;
      }
    }

    return {
      contentType: bestType,
      confidence: bestScore,
      reasons: bestReasons,
      detectedVia: results[0].detectedVia,
    };
  }

  // Default fallback
  // Se non abbiamo EPG, probabilmente è on-demand
  // Se abbiamo EPG, probabilmente è live
  return {
    contentType: options.epgUrl ? ContentType.LIVE : ContentType.UNKNOWN,
    confidence: 0.3,
    reasons: ['Nessun pattern riconosciuto - classificazione default'],
    detectedVia: 'default',
  };
}

/**
 * Utility: Controlla se un contenuto è presumibilmente live
 */
export function isLiveContent(detectionResult: ContentDetectionResult): boolean {
  return detectionResult.contentType === ContentType.LIVE;
}

/**
 * Utility: Controlla se un contenuto è presumibilmente on-demand
 */
export function isOnDemandContent(detectionResult: ContentDetectionResult): boolean {
  return (
    detectionResult.contentType === ContentType.ON_DEMAND ||
    detectionResult.contentType === ContentType.VOD
  );
}

/**
 * Utility: Get human-readable label
 */
export function getContentTypeLabel(contentType: ContentType): string {
  const labels: Record<ContentType, string> = {
    [ContentType.LIVE]: '🔴 Live',
    [ContentType.ON_DEMAND]: '📺 On-demand',
    [ContentType.VOD]: '📹 VOD',
    [ContentType.CATCHUP]: '⏱️ Replay',
    [ContentType.UNKNOWN]: '❓ Unknown',
  };
  return labels[contentType] || labels[ContentType.UNKNOWN];
}

/**
 * Utility: Get color CSS for content type
 */
export function getContentTypeColor(contentType: ContentType): string {
  const colors: Record<ContentType, string> = {
    [ContentType.LIVE]: 'bg-red-500',          // 🔴 Live - Red
    [ContentType.ON_DEMAND]: 'bg-blue-500',    // 📺 On-demand - Blue
    [ContentType.VOD]: 'bg-purple-500',        // 📹 VOD - Purple
    [ContentType.CATCHUP]: 'bg-orange-500',    // ⏱️ Replay - Orange
    [ContentType.UNKNOWN]: 'bg-gray-500',      // ❓ Unknown - Gray
  };
  return colors[contentType] || colors[ContentType.UNKNOWN];
}

/**
 * Debug: Mostra il processo di detection
 */
export function debugDetection(options: {
  channelName: string;
  groupTitle?: string;
  url: string;
  tvgId?: string;
  epgUrl?: string;
  hasEpgData?: boolean;
}): void {
  console.group(`🔍 Content Detection Debug: "${options.channelName}"`);

  console.log('📝 Input:');
  console.table({
    'Channel Name': options.channelName,
    'Group Title': options.groupTitle || 'N/A',
    'TVG ID': options.tvgId || 'N/A',
    'EPG URL': options.epgUrl ? '✓' : 'N/A',
    'Has EPG Data': options.hasEpgData ? '✓' : '✗',
    'Stream URL': options.url.substring(0, 50) + '...',
  });

  const result = detectContentType(options);

  console.log('🎯 Result:');
  console.table({
    'Content Type': result.contentType,
    'Confidence': `${(result.confidence * 100).toFixed(1)}%`,
    'Detected Via': result.detectedVia,
  });

  console.log('💡 Reasons:');
  result.reasons.forEach((reason) => console.log(`  • ${reason}`));

  console.groupEnd();
}
