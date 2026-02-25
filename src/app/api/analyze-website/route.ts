/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Attempt to fetch the HTML
        let targetUrl = url;
        if (!targetUrl.startsWith('http')) {
            targetUrl = `https://${url}`;
        }

        const start = Date.now();
        let html = '';
        let fetchedUrl = targetUrl;

        try {
            const response = await axios.get(targetUrl, { timeout: 10000 });
            html = response.data;
            fetchedUrl = response.request?.res?.responseUrl || targetUrl;
        } catch (_err: unknown) {
            // If HTTPS fails, it's a huge flag for legacy. Try HTTP.
            if (targetUrl.startsWith('https')) {
                targetUrl = targetUrl.replace('https://', 'http://');
                try {
                    const response = await axios.get(targetUrl, { timeout: 10000 });
                    html = response.data;
                    fetchedUrl = response.request?.res?.responseUrl || targetUrl;
                } catch (_innerErr: unknown) {
                    return NextResponse.json({ score: 0, category: 'Legacy', insights: ['Website is unreachable or down'], isSecure: false });
                }
            } else {
                return NextResponse.json({ score: 0, category: 'Legacy', insights: ['Website is unreachable or down'], isSecure: false });
            }
        }

        const fetchTime = Date.now() - start;
        const $ = cheerio.load(html);

        let score = 10;
        const insights: string[] = [];

        // 1. Check for HTTPS
        const isSecure = fetchedUrl.startsWith('https://');
        if (!isSecure) {
            score -= 3;
            insights.push('Not using HTTPS (Security Risk)');
        }

        // 2. Mobile Responsiveness (Viewport meta tag)
        const viewport = $('meta[name="viewport"]').attr('content');
        if (!viewport) {
            score -= 3;
            insights.push('Missing viewport meta tag (Not Mobile Friendly)');
        }

        // 3. Old HTML Tags check
        let hasOldTags = false;
        $('font, center, marquee, frameset, table[width]').each(() => { hasOldTags = true; });
        if (hasOldTags) {
            score -= 4;
            insights.push('Uses deprecated HTML tags (e.g. <font>, <center>, <table> for layout)');
        }

        // 4. Check for Modern Tech Stack Signatures
        let hasModernTech = false;
        // Look for Next.js, Nuxt, React, Vue, Svelte markers
        if ($('#__next').length || $('[data-reactroot]').length || $('#__nuxt').length || $('script[src*="_next"]').length) {
            hasModernTech = true;
        }

        if (hasModernTech) {
            score = Math.min(score + 2, 10);
            insights.push('Uses modern web frameworks (React, Next, Vue, etc)');
        } else {
            score -= 1;
            insights.push('No obvious modern Javascript framework detected');
        }

        // 5. Detect CMS (WordPress often indicates older monolithic unless headless, but neutral)
        if (html.includes('wp-content') || $('meta[name="generator"]').attr('content')?.toLowerCase().includes('wordpress')) {
            insights.push('Built with WordPress');
            // If it's old and WP, ding it a bit more
            if (!isSecure || !viewport) {
                score -= 1;
            }
        }

        // 6. Slow response? 
        if (fetchTime > 3000) {
            score -= 1;
            insights.push('Website load time is unusually slow');
        }

        // Final categorization
        let category = 'Average';
        if (score >= 8) category = 'Modern';
        else if (score <= 5) category = 'Legacy';

        return NextResponse.json({
            score,
            category,
            insights,
            isSecure
        });

    } catch (err: unknown) {
        console.error('Website analysis error:', err);
        return NextResponse.json({ error: 'Failed to analyze website' }, { status: 500 });
    }
}
