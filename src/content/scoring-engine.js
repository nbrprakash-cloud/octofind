/**
 * @file        scoring-engine.js
 * @description Intent-first promo classifier for Reddit comments/posts.
 * @module      PromoHighlighter.ScoringEngine
 * @version     1.0.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.ScoringEngine = (() => {
    const TOOL_HEAVY_SUBREDDITS = new Set([
        'androidapps',
        'devops',
        'javascript',
        'learnprogramming',
        'macapps',
        'productivity',
        'programming',
        'reactjs',
        'saas',
        'selfhosted',
        'software',
        'startups',
        'sysadmin',
        'webdev',
    ]);

    const RECOMMENDATION_SUBREDDITS = new Set([
        'androidapps',
        'macapps',
        'productivity',
        'saas',
        'selfhosted',
        'software',
    ]);

    const SAFE_REFERENCE_DOMAINS = new Set([
        'archive.org',
        'bbc.com',
        'bing.com',
        'cnn.com',
        'discord.com',
        'docs.google.com',
        'duckduckgo.com',
        'drive.google.com',
        'en.wikipedia.org',
        'github.com',
        'gitlab.com',
        'google.com',
        'imgur.com',
        'i.redd.it',
        'linkedin.com',
        'mail.google.com',
        'medium.com',
        'new.reddit.com',
        'npmjs.com',
        'old.reddit.com',
        'pypi.org',
        'reddit.com',
        'reuters.com',
        'stackoverflow.com',
        'twitter.com',
        'wikipedia.org',
        'x.com',
        'youtube.com',
        'youtu.be',
    ]);

    const SOCIAL_DOMAINS = new Set([
        'discord.com',
        'facebook.com',
        'instagram.com',
        'linkedin.com',
        'medium.com',
        'substack.com',
        'telegram.org',
        'tiktok.com',
        'twitter.com',
        'x.com',
        'youtube.com',
        'youtu.be',
    ]);

    const SHORTENER_DOMAINS = new Set([
        'bit.ly',
        'cutt.ly',
        'tinyurl.com',
        't.co',
        'tiny.cc',
        'rebrand.ly',
    ]);

    const STOPWORDS = new Set([
        'a', 'about', 'after', 'again', 'against', 'all', 'also', 'am', 'an', 'and',
        'any', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'can', 'could',
        'did', 'do', 'does', 'doing', 'for', 'from', 'had', 'has', 'have', 'having',
        'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into',
        'is', 'it', 'its', 'just', 'me', 'more', 'most', 'my', 'no', 'not', 'of',
        'on', 'or', 'our', 'out', 'really', 'she', 'so', 'some', 'than', 'that',
        'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
        'to', 'too', 'up', 'use', 'used', 'using', 'very', 'was', 'we', 'were',
        'what', 'when', 'where', 'which', 'who', 'why', 'with', 'would', 'you',
        'your',
    ]);

    const FAMILY_CAPS = Object.freeze({
        ownership: 25,
        cta: 20,
        affiliate_referral: 35,
        hidden_commercial: 16,
        hype: 10,
        domain_link: 16,
        context_mismatch: 15,
        repetition: 18,
    });

    const SCORE_BANDS = Object.freeze({
        normalMax: 29,
        maybeMax: 69,
        promoMin: 70,
    });

    const MAX_COMBO_SCORE = 30;
    const MIN_TRUST_DAMPENER = -30;

    const REGEX = Object.freeze({
        recommendation: /\b(?:recommend|recommendation|suggestions?|alternatives?|best\s+(?:tool|app|software|service|platform)|what\s+(?:tool|app|software)\s+do\s+you\s+use|looking\s+for|any\s+(?:tool|app|software|service)|which\s+one)\b/i,
        help: /\b(?:how\s+do\s+i|how\s+to|help|fix|issue|bug|error|install|setup|configure|config|why\s+is(?:n't|\s+not)|not\s+working|docs?)\b/i,
        comparison: /\b(?:vs\.?|versus|compare|comparison|alternative|which\s+is\s+better|x\s+or\s+y)\b/i,
        ownershipBuild: /\b(?:i|we)\s+(?:built|made|created|launched|developed|shipped|founded|wrote)\b/i,
        founder: /\b(?:founder\s+here|creator\s+of|dev\s+behind|i(?:'m| am)\s+the\s+founder|we\s+run)\b/i,
        possessiveProduct: /\b(?:my|our)\s+(?:app|tool|product|startup|service|plugin|extension|platform|software)\b/i,
        referralText: /\b(?:referral\s+code|promo\s+code|coupon\s+code|use\s+code|affiliate\s+link)\b/i,
        paidDisclosure: /\b(?:sponsored\s+by|paid\s+promotion|in\s+partnership\s+with|affiliate\s+link)\b/i,
        accessSolicitation: /\b(?:(?:dm|message|pm)\s+me\s+(?:for|if)|join\s+(?:the\s+)?waitlist|beta\s+testers?\s+wanted|message\s+me\s+for\s+access)\b/i,
        signupCta: /\b(?:sign\s+up|join\s+now|start\s+free|get\s+started|join\s+(?:the\s+)?waitlist)\b/i,
        softCta: /\b(?:check\s+it\s+out|give\s+it\s+a\s+try|try\s+it(?:\s+out)?|worth\s+checking)\b/i,
        stealthDisclaimer: /\b(?:not\s+sponsored\s+but|no\s+affiliation\s+but|not\s+an?\s+ad\s+but|full\s+disclosure)\b/i,
        pricingPitch: /\b(?:free\s+plan|free\s+tier|no\s+credit\s+card\s+required|first\s+month\s+free|get\s+\d+%?\s+off|discount|exclusive\s+deal)\b/i,
        launchPitch: /\b(?:just\s+launched|new\s+app|new\s+tool|early\s+access|soft\s+launch|beta\s+(?:access|testers?|users?))\b/i,
        manufacturedAuthenticity: /\b(?:i\s+don'?t\s+usually\s+recommend|surprised\s+nobody\s+mentioned|been\s+using\s+(?:this|it)\s+for\s+\d+|\bhonestly\b|\btbh\b)\b/i,
        hiddenRelationship: /\b(?:might\s+be\s+biased|friend'?s\s+tool|our\s+team\s+has|we'?ve\s+been\s+working\s+on)\b/i,
        recommendationVerb: /\b(?:recommend|worth\s+checking|look\s+into|consider|highly\s+recommend)\b/i,
        redirectLanguage: /\b(?:google\s+it|search\s+for\s+it|look\s+it\s+up)\b/i,
        casualPersuasion: /\b(?:honestly|tbh|not\s+gonna\s+lie)\b/i,
        openSource: /\b(?:open\s+source|self-hosted|self\s+hosted|library|package|sdk|repo|repository)\b/i,
        limitation: /\b(?:but|however|downside|drawback|overkill|expensive|not\s+perfect|depends)\b/i,
        negative: /\b(?:wouldn'?t\s+recommend|avoid|too\s+expensive|not\s+worth|not\s+great|hate|annoying)\b/i,
        specificity: /\b(?:because|for\s+my\s+\w+|for\s+our\s+\w+|workflow|in\s+production|daily|for\s+\d+\s+(?:days?|weeks?|months?|years?)|integrates|syncs|exports|markdown|api|plugin|feature)\b/i,
        substantialExplanation: /\b(?:because|if\s+you\s+need|the\s+reason|works\s+well\s+for|doesn'?t\s+work\s+well\s+for|I\s+use(?:d)?\s+it\s+for)\b/i,
        docsPath: /(?:^|\/)(?:docs?|documentation|guide|readme|wiki|issues?|blob|tree)(?:\/|$)/i,
        pricingPath: /(?:^|\/)(?:pricing|plans|billing|subscriptions?)(?:\/|$)/i,
        signupPath: /(?:^|\/)(?:signup|register|start|trial|waitlist|join|get-started)(?:\/|$)/i,
        referralParam: /(?:^|[?&])(?:ref|referral|aff|affiliate|via|coupon|partner)=/i,
        trackingParam: /(?:^|[?&])utm_[a-z_]+=/i,
    });

    const HYPE_PATTERNS = [
        /\b(?:game\s*changer|life\s*changing|best\s+ever|10\/10|must\s+have)\b/i,
        /\b(?:amazing|incredible|insane|absolute\s+best|truly\s+great|love\s+it)\b/i,
        /\b(?:changed\s+my\s+life|transformed\s+my|10x|huge\s+upgrade)\b/i,
    ];

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function normalizeText(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
    }

    function slugToken(text) {
        return (text || '')
            .toLowerCase()
            .replace(/https?:\/\/\S+/g, ' ')
            .replace(/[^a-z0-9\s.-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function splitSegments(text) {
        return normalizeText(text)
            .split(/[.!?\n;]+/)
            .map((segment) => segment.trim())
            .filter(Boolean);
    }

    function uniqueStrings(values) {
        return [...new Set((values || []).filter(Boolean))];
    }

    function tokenise(text) {
        return slugToken(text).split(/\s+/).filter(Boolean);
    }

    function getDomainStem(domain) {
        if (!domain) return '';
        const clean = domain.toLowerCase().replace(/^www\./, '');
        const parts = clean.split('.');
        return parts[0] || clean;
    }

    function isSafeReferenceDomain(domain) {
        if (!domain) return false;
        const clean = domain.toLowerCase().replace(/^www\./, '');
        if (SAFE_REFERENCE_DOMAINS.has(clean)) return true;
        if (clean.startsWith('docs.')) return true;
        if (clean.startsWith('developer.')) return true;
        return false;
    }

    function classifyLink(link) {
        const url = link?.url || '';
        const domain = (link?.domain || '').toLowerCase().replace(/^www\./, '');
        const path = (link?.path || '').toLowerCase();
        const query = (link?.query || '').toLowerCase();
        const explicitShortener = Boolean(link?.is_shortener) || SHORTENER_DOMAINS.has(domain);
        const safeDomain = Boolean(link?.is_safe_reference) || isSafeReferenceDomain(domain);
        const socialDomain = SOCIAL_DOMAINS.has(domain);

        let linkType = 'unknown';
        if (explicitShortener) {
            linkType = 'shortener';
        } else if (safeDomain && (domain === 'github.com' || domain === 'gitlab.com' || /(?:^|\/)(?:issues?|pull|blob|tree)\//i.test(path))) {
            linkType = 'repo';
        } else if (safeDomain && (REGEX.docsPath.test(path) || domain.startsWith('docs.'))) {
            linkType = 'docs';
        } else if (safeDomain || socialDomain) {
            linkType = socialDomain ? 'social' : 'reference';
        } else if (REGEX.pricingPath.test(path)) {
            linkType = 'product_pricing';
        } else if (REGEX.signupPath.test(path)) {
            linkType = 'product_signup';
        } else if (domain) {
            linkType = 'product_home';
        }

        return {
            url,
            domain,
            path,
            query,
            is_shortener: explicitShortener,
            is_safe_reference: safeDomain || ['reference', 'docs', 'repo', 'social'].includes(linkType),
            link_type: linkType,
            has_referral_param: Boolean(link?.has_referral_param) || REGEX.referralParam.test(query),
            has_tracking_param: Boolean(link?.has_tracking_param) || REGEX.trackingParam.test(query),
        };
    }

    function buildKeywordRegex(keywords) {
        if (!Array.isArray(keywords) || keywords.length === 0) return null;
        const sorted = [...keywords].filter(Boolean).sort((a, b) => b.length - a.length);
        if (sorted.length === 0) return null;
        return new RegExp(`\\b(${sorted.map(escapeRegex).join('|')})\\b`, 'gi');
    }

    function extractKeywordAnchors(text, keywords) {
        const regex = buildKeywordRegex(keywords);
        if (!regex) return [];

        const hits = [];
        let match;
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            hits.push({
                term: match[0],
                index: match.index,
                length: match[0].length,
            });
        }

        return hits;
    }

    function extractSignificantTerms(text, blockedTerms) {
        const blocked = new Set((blockedTerms || []).map((term) => term.toLowerCase()));
        return tokenise(text).filter((token) => (
            token.length >= 3 &&
            !STOPWORDS.has(token) &&
            !blocked.has(token)
        ));
    }

    function computeContextOverlap(text, contextText, blockedTerms) {
        const contextTerms = new Set(extractSignificantTerms(contextText, blockedTerms));
        if (contextTerms.size === 0) return 1;

        const textTerms = new Set(extractSignificantTerms(text, blockedTerms));
        if (textTerms.size === 0) return 0;

        let overlap = 0;
        for (const term of contextTerms) {
            if (textTerms.has(term)) overlap += 1;
        }

        return overlap / contextTerms.size;
    }

    function countPatternMatches(text, patterns) {
        const hits = [];

        for (const pattern of patterns) {
            const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
            const regex = new RegExp(pattern.source, flags);
            let match;

            while ((match = regex.exec(text)) !== null) {
                hits.push({
                    term: match[0],
                    index: match.index,
                    length: match[0].length,
                });
            }
        }

        return hits;
    }

    function firstPatternMatch(text, patterns) {
        const hits = countPatternMatches(text, patterns);
        return hits[0] || null;
    }

    function summariseFeatureSummary(precomputedFeatures) {
        return {
            uniqueDomains: [...(precomputedFeatures.uniqueDomains || [])],
            productAnchors: [...(precomputedFeatures.productAnchors || [])],
            fingerprint: precomputedFeatures.fingerprint || '',
        };
    }

    function buildItemFeatures(input, keywords = []) {
        const text = input?.text || '';
        const normalizedText = normalizeText(text);
        const classifiedLinks = (input?.extracted_links || []).map(classifyLink);
        const nonSafeLinks = classifiedLinks.filter((link) => !link.is_safe_reference);
        const linkDomainTerms = nonSafeLinks.map((link) => link.domain);
        const domainStemTerms = nonSafeLinks.map((link) => getDomainStem(link.domain));
        const keywordHits = extractKeywordAnchors(normalizedText, keywords);
        const keywordTerms = keywordHits.map((hit) => hit.term);
        const possessiveProduct = firstPatternMatch(normalizedText, [REGEX.possessiveProduct]);
        const possessiveTerms = possessiveProduct ? [possessiveProduct.term] : [];

        return Object.freeze({
            uniqueDomains: uniqueStrings(linkDomainTerms),
            productAnchors: uniqueStrings([
                ...keywordTerms,
                ...domainStemTerms,
                ...possessiveTerms,
            ]),
            fingerprint: slugToken(normalizedText).slice(0, 220),
        });
    }

    function buildContext(input, keywords, precomputedFeatures) {
        const text = input?.text || '';
        const normalizedText = normalizeText(text);
        const contextText = normalizeText(`${input?.thread_title || ''} ${input?.parent_text || ''}`);
        const classifiedLinks = (input?.extracted_links || []).map(classifyLink);
        const featureSummary = precomputedFeatures || buildItemFeatures(input, keywords);
        const subreddit = (input?.subreddit || '').toLowerCase();
        const subredditProfile = RECOMMENDATION_SUBREDDITS.has(subreddit)
            ? 'recommendation_expected'
            : TOOL_HEAVY_SUBREDDITS.has(subreddit)
                ? 'tool_heavy'
                : subreddit
                    ? 'general'
                    : 'unknown';

        const isRecommendationRequest = REGEX.recommendation.test(contextText) || subredditProfile === 'recommendation_expected';
        const isHelpRequest = REGEX.help.test(contextText);
        const isComparisonRequest = REGEX.comparison.test(contextText);

        return {
            input,
            text,
            normalizedText,
            contextText,
            segments: splitSegments(normalizedText),
            wordCount: tokenise(normalizedText).length,
            subreddit,
            subredditProfile,
            isRecommendationRequest,
            isHelpRequest,
            isComparisonRequest,
            contextOverlapRatio: computeContextOverlap(normalizedText, contextText, featureSummary.productAnchors),
            classifiedLinks,
            featureSummary: summariseFeatureSummary(featureSummary),
        };
    }

    function createAnalysisContext(input, keywords, precomputedFeatures) {
        const base = buildContext(input, keywords, precomputedFeatures);
        const directProductLinks = base.classifiedLinks.filter((link) => (
            link.link_type === 'product_home' ||
            link.link_type === 'product_pricing' ||
            link.link_type === 'product_signup'
        ));
        const safeReferenceLinks = base.classifiedLinks.filter((link) => link.is_safe_reference);
        const hasOnlySafeReferenceLinks = base.classifiedLinks.length > 0 && safeReferenceLinks.length === base.classifiedLinks.length;
        const hasShortenerLink = base.classifiedLinks.some((link) => link.link_type === 'shortener');
        const hasAffiliateLink = base.classifiedLinks.some((link) => link.has_referral_param);
        const hasDocsOrRepoLink = base.classifiedLinks.some((link) => ['docs', 'repo', 'reference'].includes(link.link_type));

        const ownershipBuildHit = firstPatternMatch(base.normalizedText, [REGEX.ownershipBuild]);
        const founderHit = firstPatternMatch(base.normalizedText, [REGEX.founder]);
        const possessiveProductHit = firstPatternMatch(base.normalizedText, [REGEX.possessiveProduct]);
        const referralTextHit = firstPatternMatch(base.normalizedText, [REGEX.referralText]);
        const paidDisclosureHit = firstPatternMatch(base.normalizedText, [REGEX.paidDisclosure]);
        const accessSolicitationHit = firstPatternMatch(base.normalizedText, [REGEX.accessSolicitation]);
        const signupCtaHit = firstPatternMatch(base.normalizedText, [REGEX.signupCta]);
        const softCtaHit = firstPatternMatch(base.normalizedText, [REGEX.softCta]);
        const stealthDisclaimerHit = firstPatternMatch(base.normalizedText, [REGEX.stealthDisclaimer]);
        const pricingPitchHit = firstPatternMatch(base.normalizedText, [REGEX.pricingPitch]);
        const launchPitchHit = firstPatternMatch(base.normalizedText, [REGEX.launchPitch]);
        const manufacturedAuthenticityHit = firstPatternMatch(base.normalizedText, [REGEX.manufacturedAuthenticity]);
        const hiddenRelationshipHit = firstPatternMatch(base.normalizedText, [REGEX.hiddenRelationship]);
        const recommendationVerbHit = firstPatternMatch(base.normalizedText, [REGEX.recommendationVerb]);
        const redirectLanguageHit = firstPatternMatch(base.normalizedText, [REGEX.redirectLanguage]);
        const casualPersuasionHit = firstPatternMatch(base.normalizedText, [REGEX.casualPersuasion]);
        const openSourceHit = firstPatternMatch(base.normalizedText, [REGEX.openSource]);
        const limitationHit = firstPatternMatch(base.normalizedText, [REGEX.limitation]);
        const negativeHit = firstPatternMatch(base.normalizedText, [REGEX.negative]);
        const specificityHit = firstPatternMatch(base.normalizedText, [REGEX.specificity, REGEX.substantialExplanation]);
        const hypeHits = countPatternMatches(base.normalizedText, HYPE_PATTERNS);

        const productAnchors = base.featureSummary.productAnchors;
        const productAnchorsLower = productAnchors.map((term) => term.toLowerCase());
        const sameProductRepeatedInText = productAnchors.some((anchor) => {
            const regex = new RegExp(`\\b${escapeRegex(anchor)}\\b`, 'gi');
            const matches = base.normalizedText.match(regex) || [];
            return matches.length >= 2;
        });

        const authorRepetition = {
            sameDomainCount: Number(input?.author_repetition_on_page?.same_domain_count || 0),
            sameProductCount: Number(input?.author_repetition_on_page?.same_product_count || 0),
            nearDuplicateCommentCount: Number(input?.author_repetition_on_page?.near_duplicate_comment_count || 0),
        };

        return {
            ...base,
            productAnchors,
            productAnchorCount: productAnchors.length,
            uniqueDomains: base.featureSummary.uniqueDomains,
            authorRepetition,
            directProductLinks,
            safeReferenceLinks,
            hasDirectProductLink: directProductLinks.length > 0,
            hasProductSignupLink: directProductLinks.some((link) => link.link_type === 'product_signup'),
            hasProductPricingLink: directProductLinks.some((link) => link.link_type === 'product_pricing'),
            hasOnlySafeReferenceLinks,
            hasDocsOrRepoLink,
            hasShortenerLink,
            hasAffiliateLink,
            hasTrackingLink: base.classifiedLinks.some((link) => link.has_tracking_param),
            ownershipBuildHit,
            founderHit,
            possessiveProductHit,
            referralTextHit,
            paidDisclosureHit,
            accessSolicitationHit,
            signupCtaHit,
            softCtaHit,
            stealthDisclaimerHit,
            pricingPitchHit,
            launchPitchHit,
            manufacturedAuthenticityHit,
            hiddenRelationshipHit,
            recommendationVerbHit,
            redirectLanguageHit,
            casualPersuasionHit,
            openSourceHit,
            limitationHit,
            negativeHit,
            specificityHit,
            hypeHits,
            isLowContextInsertion: (
                !base.isRecommendationRequest &&
                !base.isHelpRequest &&
                base.contextText.length > 0 &&
                base.contextOverlapRatio < 0.15 &&
                (productAnchors.length > 0 || directProductLinks.length > 0)
            ),
            hasSubstantiveExplanation: (
                base.wordCount >= 25 &&
                (Boolean(specificityHit) || Boolean(limitationHit) || Boolean(negativeHit))
            ),
            hasSpecificExperience: (
                /\b(?:i|we)\s+(?:use|used|using)\b/i.test(base.normalizedText) &&
                Boolean(specificityHit) &&
                !Boolean(signupCtaHit) &&
                directProductLinks.length === 0
            ),
            productAnchorsLower,
            sameProductRepeatedInText,
        };
    }

    function createHit(rule, extra = {}) {
        return {
            id: rule.id,
            name: rule.name,
            family: rule.family,
            strength: rule.strength,
            score: rule.score,
            reason: extra.reason || rule.reason,
            excerpt: extra.excerpt || null,
            terms: uniqueStrings(extra.terms || []),
        };
    }

    function hasPositiveRule(hits, family) {
        return hits.some((hit) => hit.family === family);
    }

    function hasPositiveRuleById(hits, id) {
        return hits.some((hit) => hit.id === id);
    }

    function hasDampener(hits, id) {
        return hits.some((hit) => hit.id === id);
    }

    const POSITIVE_RULES = [
        { id: 'SP1', name: 'Explicit Self-Build', family: 'ownership', strength: 'strong', score: 26, reason: 'Explicit self-build language tied to a product', when: (ctx) => ctx.ownershipBuildHit && ctx.productAnchorCount > 0 },
        { id: 'SP2', name: 'Founder Disclosure', family: 'ownership', strength: 'strong', score: 28, reason: 'Founder or creator disclosure detected', when: (ctx) => ctx.founderHit && ctx.productAnchorCount > 0 },
        { id: 'SP3', name: 'Possessive Product', family: 'ownership', strength: 'strong', score: 24, reason: 'Own product phrasing detected', when: (ctx) => Boolean(ctx.possessiveProductHit) },
        { id: 'SP4', name: 'Referral Code In Text', family: 'affiliate_referral', strength: 'strong', score: 34, reason: 'Referral or coupon code detected', when: (ctx) => Boolean(ctx.referralTextHit) },
        { id: 'SP5', name: 'Affiliate Or Referral URL', family: 'affiliate_referral', strength: 'strong', score: 32, reason: 'Referral or affiliate link parameter detected', when: (ctx) => ctx.hasAffiliateLink },
        { id: 'SP6', name: 'Paid Relationship Disclosure', family: 'affiliate_referral', strength: 'strong', score: 30, reason: 'Paid relationship or partnership disclosure detected', when: (ctx) => Boolean(ctx.paidDisclosureHit) },
        { id: 'SP7', name: 'Access Solicitation', family: 'cta', strength: 'strong', score: 24, reason: 'DM, waitlist, or access solicitation detected', when: (ctx) => Boolean(ctx.accessSolicitationHit) },
        { id: 'SP8', name: 'Signup CTA With Link', family: 'cta', strength: 'strong', score: 26, reason: 'Signup CTA paired with a direct product link', when: (ctx) => Boolean(ctx.signupCtaHit) && ctx.hasDirectProductLink },
        { id: 'SP9', name: 'Same-Domain Author Repetition', family: 'repetition', strength: 'strong', score: 24, reason: 'Same external domain repeated by the same author on this page', when: (ctx) => ctx.authorRepetition.sameDomainCount >= 1 },
        { id: 'SP10', name: 'Near-Duplicate Pitch Repetition', family: 'repetition', strength: 'strong', score: 28, reason: 'Near-duplicate pitch repeated by the same author on this page', when: (ctx) => ctx.authorRepetition.nearDuplicateCommentCount >= 1 && (ctx.productAnchorCount > 0 || ctx.hasDirectProductLink) },
        { id: 'MS1', name: 'Direct Product Link', family: 'domain_link', strength: 'medium', score: 12, reason: 'Direct product or landing page link detected', when: (ctx) => ctx.hasDirectProductLink },
        { id: 'MS2', name: 'CTA Without Link', family: 'cta', strength: 'medium', score: 12, reason: 'Call-to-action language detected', when: (ctx) => Boolean(ctx.signupCtaHit || ctx.softCtaHit) && !ctx.hasDirectProductLink },
        { id: 'MS3', name: 'Stealth Disclaimer', family: 'hidden_commercial', strength: 'medium', score: 14, reason: 'Stealth disclaimer detected', when: (ctx) => Boolean(ctx.stealthDisclaimerHit) },
        { id: 'MS4', name: 'Pricing Pitch', family: 'affiliate_referral', strength: 'medium', score: 11, reason: 'Pricing or free-tier pitch detected', when: (ctx) => Boolean(ctx.pricingPitchHit) },
        { id: 'MS5', name: 'Hype Cluster', family: 'hype', strength: 'medium', score: 10, reason: 'Cluster of sales-style hype language detected', when: (ctx) => ctx.hypeHits.length >= 2 && ctx.productAnchorCount > 0 },
        { id: 'MS6', name: 'Single-Brand Certainty Answer', family: 'context_mismatch', strength: 'medium', score: 12, reason: 'Single-brand certainty answer in a recommendation thread', when: (ctx) => ctx.isRecommendationRequest && ctx.productAnchorCount === 1 && !ctx.limitationHit && !ctx.negativeHit && (Boolean(ctx.recommendationVerbHit) || /\b(?:best|just\s+use|go\s+with)\b/i.test(ctx.normalizedText)) },
        { id: 'MS7', name: 'Low-Context Product Insertion', family: 'context_mismatch', strength: 'medium', score: 14, reason: 'Product insertion does not fit the thread or parent context', when: (ctx) => ctx.isLowContextInsertion },
        { id: 'MS8', name: 'Manufactured Authenticity', family: 'hidden_commercial', strength: 'medium', score: 10, reason: 'Fake-neutral authenticity framing detected', when: (ctx) => Boolean(ctx.manufacturedAuthenticityHit) && !ctx.specificityHit },
        { id: 'MS9', name: 'Launch Or Beta Pitch', family: 'hype', strength: 'medium', score: 10, reason: 'Launch or beta-pitch language detected', when: (ctx) => Boolean(ctx.launchPitchHit) && (ctx.productAnchorCount > 0 || ctx.hasDirectProductLink) },
        { id: 'MS10', name: 'In-Item Repetition', family: 'repetition', strength: 'medium', score: 10, reason: 'Same product or domain repeated several times in the item', when: (ctx) => ctx.sameProductRepeatedInText },
        { id: 'MS11', name: 'Shortener Or Opaque Link', family: 'domain_link', strength: 'medium', score: 13, reason: 'Opaque or shortened link detected', when: (ctx) => ctx.hasShortenerLink },
        { id: 'MS12', name: 'Hidden Relationship Hedge', family: 'hidden_commercial', strength: 'medium', score: 12, reason: 'Hidden relationship or bias hedge detected', when: (ctx) => Boolean(ctx.hiddenRelationshipHit) },
        { id: 'WS1', name: 'One Non-Safe Domain', family: 'domain_link', strength: 'weak', score: 4, reason: 'External non-reference domain detected', when: (ctx) => ctx.uniqueDomains.length === 1 && !ctx.hasDirectProductLink },
        { id: 'WS2', name: 'Mild Recommendation Verb', family: 'hype', strength: 'weak', score: 4, reason: 'Mild recommendation language detected', when: (ctx) => Boolean(ctx.recommendationVerbHit) },
        { id: 'WS3', name: 'Single Hype Word', family: 'hype', strength: 'weak', score: 4, reason: 'Isolated hype language detected', when: (ctx) => ctx.hypeHits.length === 1 },
        { id: 'WS4', name: 'Brand-First Minimal Answer', family: 'context_mismatch', strength: 'weak', score: 6, reason: 'Short brand-first answer with little explanation', when: (ctx) => ctx.wordCount > 0 && ctx.wordCount < 8 && ctx.productAnchorCount >= 1 },
        { id: 'WS5', name: 'Newness Mention', family: 'hype', strength: 'weak', score: 4, reason: 'Newness framing detected', when: (ctx) => Boolean(ctx.launchPitchHit) && !ctx.hasDirectProductLink },
        { id: 'WS6', name: 'Redirect Language', family: 'cta', strength: 'weak', score: 5, reason: 'Redirect language detected', when: (ctx) => Boolean(ctx.redirectLanguageHit) },
        { id: 'WS7', name: 'Casual Persuasion Filler', family: 'hidden_commercial', strength: 'weak', score: 3, reason: 'Casual persuasion filler detected', when: (ctx) => Boolean(ctx.casualPersuasionHit) && ctx.hypeHits.length > 0 },
    ];

    const DAMPENER_RULES = [
        { id: 'TD1', name: 'Multi-Option Direct Answer', score: -16, reason: 'Recommendation thread with multiple options and no CTA or ownership', when: (ctx, positives) => ctx.isRecommendationRequest && ctx.productAnchorCount >= 2 && !hasPositiveRule(positives, 'ownership') && !hasPositiveRule(positives, 'affiliate_referral') && !hasPositiveRule(positives, 'cta') },
        { id: 'TD2', name: 'Balanced Comparison', score: -14, reason: 'Balanced comparison with tradeoffs detected', when: (ctx) => (ctx.isComparisonRequest || /\b(?:vs\.?|alternative|compared\s+to)\b/i.test(ctx.normalizedText)) && (Boolean(ctx.limitationHit) || Boolean(ctx.negativeHit)) },
        { id: 'TD3', name: 'Specific First-Person Experience', score: -10, reason: 'Specific first-person usage experience detected', when: (ctx) => ctx.hasSpecificExperience },
        { id: 'TD4', name: 'Limitation Or Caution', score: -8, reason: 'Caveat or caution language weakens promo intent', when: (ctx) => Boolean(ctx.limitationHit) || Boolean(ctx.negativeHit) },
        { id: 'TD5', name: 'Technical Help With Docs Or Repo', score: -18, reason: 'Technical help reply with docs or repo reference detected', when: (ctx) => ctx.isHelpRequest && ctx.hasDocsOrRepoLink },
        { id: 'TD6', name: 'Open-Source Or Library Context', score: -12, reason: 'Open-source or library discussion detected', when: (ctx) => Boolean(ctx.openSourceHit) && !ctx.hasDirectProductLink && !ctx.hasAffiliateLink },
        { id: 'TD7', name: 'Safe-Link Reference Only', score: -10, reason: 'Only safe reference links are present', when: (ctx) => ctx.hasOnlySafeReferenceLinks },
        { id: 'TD8', name: 'Substantive Noncommercial Explanation', score: -8, reason: 'Substantive explanation outweighs promotional tone', when: (ctx) => ctx.hasSubstantiveExplanation && !ctx.hasAffiliateLink },
    ];

    const COMBO_RULES = [
        { id: 'C1', score: 22, reason: 'Ownership plus CTA plus direct link', when: (ctx, positives) => hasPositiveRule(positives, 'ownership') && hasPositiveRule(positives, 'cta') && ctx.hasDirectProductLink },
        { id: 'C2', score: 25, reason: 'Referral or discount language paired with a link', when: (ctx, positives) => (hasPositiveRuleById(positives, 'SP4') || hasPositiveRuleById(positives, 'SP5') || (hasPositiveRuleById(positives, 'MS4') && /\b(?:off|discount|deal|coupon)\b/i.test(ctx.pricingPitchHit?.term || ''))) && ctx.hasDirectProductLink && ctx.productAnchorCount > 0 },
        { id: 'C3', score: 16, reason: 'Stealth disclaimer paired with hype and single-brand praise', when: (ctx, positives) => hasPositiveRuleById(positives, 'MS3') && (hasPositiveRuleById(positives, 'MS5') || hasPositiveRuleById(positives, 'WS3')) && ctx.productAnchorCount === 1 },
        { id: 'C4', score: 18, reason: 'Context mismatch paired with traffic-driving behavior', when: (ctx, positives) => hasPositiveRuleById(positives, 'MS7') && (ctx.hasDirectProductLink || hasPositiveRule(positives, 'cta')) },
        { id: 'C5', score: 15, reason: 'Repeated domain or product push by the same author', when: (ctx, positives) => hasPositiveRule(positives, 'repetition') && (ctx.authorRepetition.sameDomainCount >= 1 || ctx.authorRepetition.sameProductCount >= 1) },
        { id: 'C6', score: 12, reason: 'Recommendation-thread answer drops a single linked option without caveats', when: (ctx) => ctx.isRecommendationRequest && ctx.productAnchorCount === 1 && ctx.hasDirectProductLink && !ctx.limitationHit },
        { id: 'C7', score: 18, reason: 'Launch or beta pitch from an owner or founder', when: (ctx, positives) => hasPositiveRuleById(positives, 'MS9') && (hasPositiveRuleById(positives, 'SP1') || hasPositiveRuleById(positives, 'SP2') || hasPositiveRuleById(positives, 'SP3')) },
        { id: 'C8', score: 15, reason: 'Opaque link combined with CTA and praise', when: (ctx, positives) => hasPositiveRuleById(positives, 'MS11') && hasPositiveRule(positives, 'cta') && (hasPositiveRuleById(positives, 'MS5') || hasPositiveRuleById(positives, 'WS3')) },
        { id: 'C9', score: 12, reason: 'Hype, pricing pitch, and CTA appear together', when: (ctx, positives) => hasPositiveRuleById(positives, 'MS4') && (hasPositiveRuleById(positives, 'MS5') || hasPositiveRuleById(positives, 'WS3')) && hasPositiveRule(positives, 'cta') },
        { id: 'C10', score: 20, reason: 'Relationship signal paired with DM funnel behavior', when: (ctx, positives) => (hasPositiveRule(positives, 'ownership') || hasPositiveRuleById(positives, 'MS12')) && Boolean(ctx.accessSolicitationHit) },
    ];

    function applyContextAdjustment(hit, ctx) {
        let score = hit.score;

        if (ctx.isRecommendationRequest && ['domain_link', 'hype', 'context_mismatch'].includes(hit.family) && hit.strength !== 'strong') {
            score = Math.round(score * 0.75);
        }

        if (ctx.subredditProfile === 'tool_heavy' && ['domain_link', 'hype'].includes(hit.family) && hit.strength !== 'strong') {
            score = Math.round(score * 0.8);
        }

        if (ctx.subredditProfile === 'tool_heavy' && hit.id === 'MS1' && !ctx.hasProductSignupLink && !ctx.hasProductPricingLink) {
            score = Math.round(score * 0.8);
        }

        return { ...hit, score };
    }

    function collectPositiveHits(ctx) {
        const hits = [];

        for (const rule of POSITIVE_RULES) {
            if (!rule.when(ctx)) continue;

            let excerpt = null;
            if (rule.id === 'SP1' && ctx.ownershipBuildHit) excerpt = ctx.ownershipBuildHit.term;
            if (rule.id === 'SP2' && ctx.founderHit) excerpt = ctx.founderHit.term;
            if (rule.id === 'SP3' && ctx.possessiveProductHit) excerpt = ctx.possessiveProductHit.term;
            if (rule.id === 'SP4' && ctx.referralTextHit) excerpt = ctx.referralTextHit.term;
            if (rule.id === 'SP6' && ctx.paidDisclosureHit) excerpt = ctx.paidDisclosureHit.term;
            if (rule.id === 'SP7' && ctx.accessSolicitationHit) excerpt = ctx.accessSolicitationHit.term;
            if (rule.id === 'SP8' && ctx.signupCtaHit) excerpt = ctx.signupCtaHit.term;
            if (rule.id === 'MS2') excerpt = ctx.signupCtaHit?.term || ctx.softCtaHit?.term || null;
            if (rule.id === 'MS3' && ctx.stealthDisclaimerHit) excerpt = ctx.stealthDisclaimerHit.term;
            if (rule.id === 'MS4' && ctx.pricingPitchHit) excerpt = ctx.pricingPitchHit.term;
            if (rule.id === 'MS8' && ctx.manufacturedAuthenticityHit) excerpt = ctx.manufacturedAuthenticityHit.term;
            if (rule.id === 'MS9' && ctx.launchPitchHit) excerpt = ctx.launchPitchHit.term;
            if (rule.id === 'MS12' && ctx.hiddenRelationshipHit) excerpt = ctx.hiddenRelationshipHit.term;
            if (rule.id === 'WS2' && ctx.recommendationVerbHit) excerpt = ctx.recommendationVerbHit.term;
            if (rule.id === 'WS3' && ctx.hypeHits[0]) excerpt = ctx.hypeHits[0].term;
            if (rule.id === 'WS6' && ctx.redirectLanguageHit) excerpt = ctx.redirectLanguageHit.term;
            if (rule.id === 'WS7' && ctx.casualPersuasionHit) excerpt = ctx.casualPersuasionHit.term;

            hits.push(applyContextAdjustment(createHit(rule, {
                excerpt,
                terms: uniqueStrings([
                    excerpt,
                    ...ctx.productAnchors.slice(0, 3),
                    ...ctx.uniqueDomains.slice(0, 2),
                ]),
            }), ctx));
        }

        return hits;
    }

    function collectDampenerHits(ctx, positives) {
        return DAMPENER_RULES
            .filter((rule) => rule.when(ctx, positives))
            .map((rule) => ({
                id: rule.id,
                name: rule.name,
                score: rule.score,
                reason: rule.reason,
            }));
    }

    function collectComboHits(ctx, positives, dampeners) {
        return COMBO_RULES
            .filter((rule) => rule.when(ctx, positives, dampeners))
            .map((rule) => ({
                id: rule.id,
                score: rule.score,
                reason: rule.reason,
            }));
    }

    function capPositiveScore(hits) {
        const familyScores = {
            ownership: 0,
            cta: 0,
            affiliate_referral: 0,
            hidden_commercial: 0,
            hype: 0,
            domain_link: 0,
            context_mismatch: 0,
            repetition: 0,
        };

        for (const hit of hits) {
            const cap = FAMILY_CAPS[hit.family] || hit.score;
            familyScores[hit.family] = Math.min(cap, familyScores[hit.family] + hit.score);
        }

        return familyScores;
    }

    function sumValues(obj) {
        return Object.values(obj).reduce((sum, value) => sum + value, 0);
    }

    function sumHitScores(hits) {
        return hits.reduce((sum, hit) => sum + hit.score, 0);
    }

    function clamp(num, min, max) {
        return Math.max(min, Math.min(max, num));
    }

    function thresholdLabel(score) {
        if (score >= SCORE_BANDS.promoMin) return 'promo';
        if (score >= SCORE_BANDS.normalMax + 1) return 'maybe_promo';
        return 'normal';
    }

    function onlyWeakPositives(hits) {
        return hits.length > 0 && hits.every((hit) => hit.strength === 'weak');
    }

    function onlyGenericSignals(hits) {
        if (hits.length === 0) return false;
        const genericIds = new Set(['WS1', 'WS2', 'WS3', 'WS4', 'WS5', 'WS6', 'WS7', 'MS1', 'MS5']);
        return hits.every((hit) => genericIds.has(hit.id));
    }

    function hasStrongPlusSupport(positives, combos) {
        const strongCount = positives.filter((hit) => hit.strength === 'strong').length;
        return strongCount >= 1 && (positives.length >= 2 || combos.length >= 1);
    }

    function hasThreeMediumFamilies(positives) {
        const mediumHits = positives.filter((hit) => hit.strength === 'medium');
        return mediumHits.length >= 3 && new Set(mediumHits.map((hit) => hit.family)).size >= 3;
    }

    function computeHardGates(ctx, positives, dampeners, combos) {
        const forcePromo = (
            hasPositiveRuleById(positives, 'SP4') ||
            (hasPositiveRuleById(positives, 'SP5') && ctx.productAnchorCount > 0) ||
            hasPositiveRuleById(positives, 'SP6') ||
            combos.some((combo) => combo.id === 'C1') ||
            ((hasPositiveRuleById(positives, 'SP9') || hasPositiveRuleById(positives, 'SP10')) && (ctx.hasDirectProductLink || hasPositiveRule(positives, 'cta')))
        );

        let minScore = 0;
        if (
            (hasPositiveRuleById(positives, 'SP1') || hasPositiveRuleById(positives, 'SP2') || hasPositiveRuleById(positives, 'SP3')) &&
            (ctx.hasDirectProductLink || hasPositiveRule(positives, 'cta'))
        ) {
            minScore = Math.max(minScore, 55);
        }
        if (hasPositiveRuleById(positives, 'SP7')) minScore = Math.max(minScore, 55);
        if (combos.some((combo) => combo.id === 'C7')) minScore = Math.max(minScore, 55);
        if (hasPositiveRuleById(positives, 'MS7') && ctx.hasDirectProductLink) minScore = Math.max(minScore, 45);

        const forceNormal = (
            !forcePromo &&
            combos.length === 0 &&
            !hasPositiveRule(positives, 'ownership') &&
            !hasPositiveRule(positives, 'affiliate_referral') &&
            (hasDampener(dampeners, 'TD1') || hasDampener(dampeners, 'TD2') || hasDampener(dampeners, 'TD5') || hasDampener(dampeners, 'TD6') || hasDampener(dampeners, 'TD7'))
        );

        let maxLabel = null;
        if (
            onlyWeakPositives(positives) ||
            onlyGenericSignals(positives) ||
            ((hasDampener(dampeners, 'TD2') || hasDampener(dampeners, 'TD5') || hasDampener(dampeners, 'TD6')) &&
                !hasPositiveRuleById(positives, 'SP4') &&
                !hasPositiveRuleById(positives, 'SP5') &&
                !combos.some((combo) => combo.id === 'C1'))
        ) {
            maxLabel = 'maybe_promo';
        }

        return { forcePromo, forceNormal, maxLabel, minScore };
    }

    function applyGuardrails(score, ctx, positives, dampeners, combos, hardGates, notes) {
        let guardedScore = Math.max(score, hardGates.minScore || 0);

        if (onlyWeakPositives(positives)) {
            guardedScore = Math.min(guardedScore, 24);
            notes.push('Weak-only evidence cannot escalate beyond normal');
        }

        if (
            (hasDampener(dampeners, 'TD1') || hasDampener(dampeners, 'TD2') || hasDampener(dampeners, 'TD5') || hasDampener(dampeners, 'TD6')) &&
            !hasPositiveRuleById(positives, 'SP4') &&
            !hasPositiveRuleById(positives, 'SP5') &&
            !hasPositiveRuleById(positives, 'SP6') &&
            !combos.some((combo) => combo.id === 'C1')
        ) {
            guardedScore = Math.min(guardedScore, 54);
            notes.push('Strong trust context caps severity unless hard promo evidence exists');
        }

        if (ctx.isRecommendationRequest && hasDampener(dampeners, 'TD1') && !hasStrongPlusSupport(positives, combos)) {
            guardedScore = Math.min(guardedScore, 29);
            notes.push('Recommendation thread answer de-escalated by trust dampener');
        }

        return clamp(guardedScore, 0, 100);
    }

    function distanceFromNearestThreshold(score) {
        return Math.min(
            Math.abs(score - SCORE_BANDS.normalMax),
            Math.abs(score - SCORE_BANDS.promoMin)
        );
    }

    function computeConfidence(score, label, ctx, positives, dampeners, combos, hardGates) {
        const strongCount = positives.filter((hit) => hit.strength === 'strong').length;
        const strongDampeners = dampeners.filter((hit) => ['TD1', 'TD2', 'TD5', 'TD6'].includes(hit.id)).length;
        const hasConflictingContext = (
            ctx.isRecommendationRequest ||
            ctx.isHelpRequest ||
            ctx.subredditProfile === 'tool_heavy'
        ) && label !== 'normal';

        return clamp(
            0.40 +
            (hardGates.forcePromo || hardGates.forceNormal ? 0.15 : 0) +
            0.10 * Math.min(strongCount, 2) +
            0.05 * Math.min(combos.length, 2) +
            Math.min(0.15, distanceFromNearestThreshold(score) / 40) -
            0.08 * Math.min(strongDampeners, 2) -
            (hasConflictingContext ? 0.10 : 0),
            0.05,
            0.99
        );
    }

    function buildMatches(ctx, positives) {
        const terms = uniqueStrings([
            ...positives.flatMap((hit) => hit.terms || []),
            ...ctx.productAnchors,
            ...ctx.uniqueDomains,
        ]).filter((term) => term && term.length >= 3);

        return terms.slice(0, 8).map((term) => {
            const index = ctx.normalizedText.toLowerCase().indexOf(term.toLowerCase());
            return {
                term,
                index: index >= 0 ? index : 0,
                length: term.length,
            };
        });
    }

    function buildTopReasons(positives, combos) {
        return [...positives, ...combos]
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((hit) => hit.reason);
    }

    function buildWhyItMightBeWrong(ctx, score, positives, dampeners) {
        const notes = [];

        if (ctx.isRecommendationRequest) notes.push('Recommendation context lowers certainty');
        if (ctx.isHelpRequest) notes.push('Help context lowers certainty');
        if (ctx.subredditProfile === 'tool_heavy') notes.push('Tool-heavy subreddit lowers certainty');
        if (score >= 25 && score <= 35) notes.push('Score is close to the normal/maybe threshold');
        if (score >= 58 && score <= 72) notes.push('Score is close to the maybe/promo threshold');
        if (positives.every((hit) => hit.strength !== 'strong')) notes.push('No hard commercial signal was detected');
        if (dampeners.length >= 2) notes.push('Trust dampeners conflict with some suspicion signals');

        return uniqueStrings(notes).slice(0, 4);
    }

    function buildExplanation(label, score, confidence, positives, dampeners, combos, hardGates, notes, ctx) {
        const familyScores = capPositiveScore(positives);
        const dampenerScore = clamp(sumHitScores(dampeners), MIN_TRUST_DAMPENER, 0);
        const comboScore = Math.min(MAX_COMBO_SCORE, sumHitScores(combos));

        return {
            label,
            score,
            confidence,
            promo_candidate: label === 'promo' || hasStrongPlusSupport(positives, combos) || hasThreeMediumFamilies(positives),
            hard_gates: {
                force_promo: hardGates.forcePromo,
                force_normal: hardGates.forceNormal,
                max_label: hardGates.maxLabel,
            },
            matched_rules: positives.map((hit) => ({
                id: hit.id,
                family: hit.family,
                strength: hit.strength,
                score: hit.score,
                excerpt: hit.excerpt,
            })),
            positive_evidence: positives.map((hit) => hit.reason),
            negative_evidence: dampeners.map((hit) => hit.reason),
            combo_triggers: combos,
            family_scores: {
                ...familyScores,
                trust_dampeners: dampenerScore,
                combo_bonus: comboScore,
            },
            top_reasons: buildTopReasons(positives, combos),
            why_might_be_wrong: buildWhyItMightBeWrong(ctx, score, positives, dampeners),
            notes,
        };
    }

    function analyzeItem(input, keywords = [], precomputedFeatures = null) {
        const ctx = createAnalysisContext(input, keywords, precomputedFeatures);
        const positives = collectPositiveHits(ctx);
        const dampeners = collectDampenerHits(ctx, positives);
        const combos = collectComboHits(ctx, positives, dampeners);

        const positiveScore = sumValues(capPositiveScore(positives));
        const comboScore = Math.min(MAX_COMBO_SCORE, sumHitScores(combos));
        const dampenerScore = clamp(sumHitScores(dampeners), MIN_TRUST_DAMPENER, 0);

        let score = clamp(positiveScore + comboScore + dampenerScore, 0, 100);
        const notes = [];
        const hardGates = computeHardGates(ctx, positives, dampeners, combos);
        score = applyGuardrails(score, ctx, positives, dampeners, combos, hardGates, notes);

        let label = thresholdLabel(score);
        if (hardGates.forcePromo) label = 'promo';
        if (hardGates.forceNormal) label = 'normal';
        if (hardGates.maxLabel === 'maybe_promo' && label === 'promo') label = 'maybe_promo';

        const promoCandidate = hardGates.forcePromo || hasStrongPlusSupport(positives, combos) || hasThreeMediumFamilies(positives);
        if (label === 'promo' && !promoCandidate) {
            label = 'maybe_promo';
            notes.push('Promo label blocked because evidence did not clear the promo candidate guardrail');
        }

        const confidence = computeConfidence(score, label, ctx, positives, dampeners, combos, hardGates);
        const severity = label === 'promo' ? 'red' : label === 'maybe_promo' ? 'yellow' : null;
        const explanation = buildExplanation(label, score, confidence, positives, dampeners, combos, hardGates, notes, ctx);

        return {
            label,
            severity,
            totalScore: score,
            score,
            confidence,
            reasons: explanation.top_reasons,
            topReasons: explanation.top_reasons,
            matches: buildMatches(ctx, positives),
            matchedRules: explanation.matched_rules,
            positiveEvidence: explanation.positive_evidence,
            negativeEvidence: explanation.negative_evidence,
            comboTriggers: explanation.combo_triggers,
            hardGates: explanation.hard_gates,
            notes: explanation.notes,
            whyMightBeWrong: explanation.why_might_be_wrong,
            explanation,
            featureSummary: ctx.featureSummary,
        };
    }

    function analyzeText(text, keywords = []) {
        return analyzeItem({
            item_type: 'comment',
            text,
            subreddit: '',
            thread_title: '',
            parent_text: null,
            extracted_links: [],
            extracted_domains: [],
            links_present: false,
            author_repetition_on_page: {
                same_domain_count: 0,
                same_product_count: 0,
                near_duplicate_comment_count: 0,
            },
        }, keywords);
    }

    return Object.freeze({
        buildItemFeatures,
        analyzeItem,
        analyzeText,
    });
})();
