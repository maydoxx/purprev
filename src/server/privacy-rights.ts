import { sql, now, parseJson } from "./db";
import { decryptText } from "./crypto";

interface UserDataExport {
    account: {
        id: number;
        username: string;
        about: string | null;
        admin: number;
        currency: number;
        tix: number;
        membership: string;
        membership_expires: number;
        created_at: number;
        social_discord: string;
        social_twitter: string;
        social_youtube: string;
        theme: string;
        social_visibility: Record<string, boolean>;
        processing_consents: Record<string, boolean>;
        processing_restricted: boolean;
        processing_objections: Record<string, boolean>;
    };
    games: Array<{
        id: number;
        title: string;
        description: string;
        genre: string;
        max_players: number;
        access: string;
        created_at: number;
        updated_at: number;
    }>;
    catalog_items: Array<{
        id: number;
        name: string;
        description: string;
        category: string;
        price: number | null;
        tix_price: number | null;
        is_limited: boolean;
        is_limited_unique: boolean;
        limited_stock: number | null;
        limited_sold: number;
        created_at: number;
        updated_at: number;
    }>;
    assets: Array<{
        id: number;
        type: string;
        name: string;
        extension: string;
        parent_id: number | null;
        created_at: number;
    }>;
    messages_sent: Array<{
        id: number;
        recipient_id: number;
        subject: string;
        body: string;
        message_type: string;
        created_at: number;
    }>;
    messages_received: Array<{
        id: number;
        sender_id: number;
        subject: string;
        body: string;
        message_type: string;
        created_at: number;
    }>;
    chat_messages: Array<{
        id: number;
        recipient_id: number;
        body: string;
        created_at: number;
    }>;
    trades: Array<{
        id: number;
        status: string;
        created_at: number;
        expires_at: number;
        completed_at: number;
        items_offered: number[];
        items_requested: number[];
    }>;
    groups_owned: Array<{
        id: number;
        name: string;
        description: string;
        created_at: number;
        updated_at: number;
    }>;
    group_memberships: Array<{
        group_id: number;
        role: string;
        rank: number;
        joined_at: number;
    }>;
    forum_threads: Array<{
        id: number;
        forum_id: number;
        subject: string;
        created_at: number;
        updated_at: number;
    }>;
    forum_posts: Array<{
        id: number;
        thread_id: number;
        body: string;
        created_at: number;
        updated_at: number;
    }>;
    game_passes: Array<{
        id: number;
        game_id: number;
        name: string;
        description: string;
        price: number | null;
        created_at: number;
        updated_at: number;
    }>;
    game_badges: Array<{
        id: number;
        game_id: number;
        name: string;
        description: string;
        enabled: boolean;
        created_at: number;
        updated_at: number;
    }>;
    developer_products: Array<{
        id: number;
        game_id: number;
        name: string;
        description: string;
        price: number | null;
        created_at: number;
        updated_at: number;
    }>;
    purchases: Array<{
        id: number;
        item_id: number;
        price: number;
        currency: string;
        purchased_at: number;
    }>;
    inventory: Array<{
        item_id: number;
        name: string;
        category: string;
        purchased_at: number;
        serial_number: number | null;
        wearing: boolean;
    }>;
    avatar: {
        colors: Record<string, number>;
        avatar_type: string;
        wearing: Array<{ item_id: number; name: string; category: string }>;
    };
    outfits: Array<{
        id: number;
        name: string;
        colors: Record<string, number>;
        items: number[];
        created_at: number;
    }>;
    friends: Array<{
        friend_id: number;
        username: string;
        status: string;
        created_at: number;
        accepted_at: number;
    }>;
    follows: Array<{
        followed_id: number;
        username: string;
        created_at: number;
    }>;
    blocks: Array<{
        blocked_id: number;
        username: string;
        created_at: number;
    }>;
    status_updates: Array<{
        id: number;
        body: string;
        created_at: number;
    }>;
    notifications: Array<{
        id: number;
        actor_id: number;
        kind: string;
        target_id: number;
        is_read: boolean;
        created_at: number;
    }>;
    applications: Array<{
        id: number;
        name: string;
        discord: string;
        found: string;
        why: string;
        revivals: string;
        about: string;
        socials: string;
        status: string;
        ip: string;
        created_at: number;
    }>;
    username_history: Array<{
        old_username: string;
        new_username: string;
        changed_at: number;
        ip: string;
    }>;
    invite_log: Array<{
        invite_key: string;
        used_by: number;
        used_at: number;
        ip: string;
        user_agent: string;
    }>;
    moderation_history: Array<{
        action: number;
        reason: string;
        moderated_by: number;
        expires_at: number;
        created_at: number;
    }>;
    security_audit: Array<{
        event: string;
        method: string;
        path: string;
        success: boolean;
        ip: string;
        details: string;
        created_at: number;
    }>;
    export_metadata: {
        exported_at: string;
        export_version: string;
        user_id: number;
    };
}

export const exportUserData = async (userId: number): Promise<UserDataExport> => {
    const [account] = await sql`
        SELECT id, username, about, admin, currency, tix, membership, membership_expires,
               created_at, social_discord, social_twitter, social_youtube, theme,
               social_visibility, processing_consents, processing_restricted, processing_objections
        FROM users WHERE id = ${userId}
    `;

    const games = await sql`
        SELECT id, title, description, genre, max_players, access, created_at, updated_at
        FROM games WHERE creator_id = ${userId}
    `;

    const catalog_items = await sql`
        SELECT id, name, description, category, price, tix_price, is_limited,
               is_limited_unique, limited_stock, limited_sold, created_at, updated_at
        FROM catalog_items WHERE creator_id = ${userId}
    `;

    const assets = await sql`
        SELECT id, type, name, extension, parent_id, created_at
        FROM assets WHERE creator_id = ${userId}
    `;

    const messages_sent = await Promise.all((await sql`
        SELECT id, recipient_id, subject, body, message_type, created_at
        FROM messages WHERE sender_id = ${userId}
    `).map(async (m: any) => ({
        ...m,
        subject: await decryptText(m.subject),
        body: await decryptText(m.body)
    })));

    const messages_received = await Promise.all((await sql`
        SELECT id, sender_id, subject, body, message_type, created_at
        FROM messages WHERE recipient_id = ${userId}
    `).map(async (m: any) => ({
        ...m,
        subject: await decryptText(m.subject),
        body: await decryptText(m.body)
    })));

    const chat_messages = await Promise.all((await sql`
        SELECT id, recipient_id, body, created_at
        FROM chat_messages WHERE sender_id = ${userId}
    `).map(async (m: any) => ({
        ...m,
        body: await decryptText(m.body)
    })));

    const trades = await sql`
        SELECT t.id, t.status, t.created_at, t.expires_at, t.completed_at
        FROM trades t WHERE t.sender_id = ${userId} OR t.receiver_id = ${userId}
    `;

    const trade_items = await sql`
        SELECT trade_id, side, item_id FROM trade_items WHERE trade_id IN (
            SELECT id FROM trades WHERE sender_id = ${userId} OR receiver_id = ${userId}
        )
    `;

    const trades_with_items = trades.map((t: any) => ({
        ...t,
        items_offered: trade_items.filter((i: any) => i.trade_id === t.id && i.side === "offer").map((i: any) => i.item_id),
        items_requested: trade_items.filter((i: any) => i.trade_id === t.id && i.side === "request").map((i: any) => i.item_id)
    }));

    const groups_owned = await sql`
        SELECT id, name, description, created_at, updated_at
        FROM site_groups WHERE owner_id = ${userId}
    `;

    const group_memberships = await sql`
        SELECT group_id, role, rank, joined_at
        FROM group_members WHERE user_id = ${userId}
    `;

    const forum_threads = await sql`
        SELECT id, forum_id, subject, created_at, updated_at
        FROM forum_threads WHERE author_id = ${userId}
    `;

    const forum_posts = await sql`
        SELECT id, thread_id, body, created_at, updated_at
        FROM forum_posts WHERE author_id = ${userId}
    `;

    const game_passes = await sql`
        SELECT id, game_id, name, description, price, created_at, updated_at
        FROM game_passes WHERE creator_id = ${userId}
    `;

    const game_badges = await sql`
        SELECT id, game_id, name, description, enabled, created_at, updated_at
        FROM game_badges WHERE creator_id = ${userId}
    `;

    const developer_products = await sql`
        SELECT id, game_id, name, description, price, created_at, updated_at
        FROM developer_products WHERE creator_id = ${userId}
    `;

    const inventory = await sql`
        SELECT ui.item_id, ci.name, ci.category, ui.purchased_at, ui.serial_number, ui.wearing
        FROM user_items ui JOIN catalog_items ci ON ci.id = ui.item_id
        WHERE ui.user_id = ${userId}
    `;

    const [avatar] = await sql`
        SELECT head_color, torso_color, left_arm_color, right_arm_color, left_leg_color, right_leg_color, avatar_type
        FROM user_avatar WHERE user_id = ${userId}
    `;

    const wearing = await sql`
        SELECT ci.id as item_id, ci.name, ci.category
        FROM user_items ui JOIN catalog_items ci ON ci.id = ui.item_id
        WHERE ui.user_id = ${userId} AND ui.wearing = 1
    `;

    const outfits = await sql`
        SELECT id, name, colors, items, created_at
        FROM avatar_outfits WHERE user_id = ${userId}
    `;

    const friends = await sql`
        SELECT CASE WHEN f.requester_id = ${userId} THEN f.target_id ELSE f.requester_id END AS friend_id,
               u.username, f.status, f.created_at, f.accepted_at
        FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = ${userId} THEN f.target_id ELSE f.requester_id END
        WHERE (f.requester_id = ${userId} OR f.target_id = ${userId}) AND f.status = 'accepted'
    `;

    const follows = await sql`
        SELECT u.id as followed_id, u.username, uf.created_at
        FROM user_follows uf JOIN users u ON u.id = uf.followed_id
        WHERE uf.follower_id = ${userId}
    `;

    const blocks = await sql`
        SELECT u.id as blocked_id, u.username, ub.created_at
        FROM user_blocks ub JOIN users u ON u.id = ub.blocked_id
        WHERE ub.blocker_id = ${userId}
    `;

    const status_updates = await sql`
        SELECT id, body, created_at FROM status_updates WHERE user_id = ${userId}
    `;

    const notifications = await sql`
        SELECT id, actor_id, kind, target_id, is_read, created_at
        FROM notifications WHERE user_id = ${userId}
    `;

    const applications = await sql`
        SELECT id, name, discord, found, why, revivals, about, socials, status, ip, created_at
        FROM applications WHERE user_id = ${userId}
    `;

    const username_history = await sql`
        SELECT old_username, new_username, changed_at, ip
        FROM username_history WHERE user_id = ${userId}
    `;

    const invite_log = await sql`
        SELECT "inviteKey" as invite_key, used_by, used_at, ip, user_agent
        FROM invite_log WHERE used_by = ${userId}
    `;

    const moderation_history = await sql`
        SELECT action, reason, "moderatedBy" as moderated_by, "expiresAt" as expires_at, created_at
        FROM moderation_actions WHERE user_id = ${userId}
    `;

    const security_audit = await sql`
        SELECT event, method, path, success, ip, details, created_at
        FROM security_audit WHERE user_id = ${userId}
    `;

    const social_visibility = parseJson(account?.social_visibility, { discord: true, twitter: true, youtube: true });
    const processing_consents = parseJson(account?.processing_consents, { marketing: false, analytics: true, profiling: false, third_party_sharing: false });
    const processing_objections = parseJson(account?.processing_objections, { marketing: false, analytics: false, profiling: false, third_party_sharing: false });

    return {
        account: {
            ...account,
            social_visibility,
            processing_consents,
            processing_restricted: Boolean(account?.processing_restricted),
            processing_objections
        } as any,
        games,
        catalog_items,
        assets,
        messages_sent,
        messages_received,
        chat_messages,
        trades: trades_with_items,
        groups_owned,
        group_memberships,
        forum_threads,
        forum_posts,
        game_passes,
        game_badges,
        developer_products,
        purchases: [],
        inventory,
        avatar: {
            colors: avatar ? { head_color: avatar.head_color, torso_color: avatar.torso_color, left_arm_color: avatar.left_arm_color, right_arm_color: avatar.right_arm_color, left_leg_color: avatar.left_leg_color, right_leg_color: avatar.right_leg_color } : {},
            avatar_type: avatar?.avatar_type || "R6",
            wearing
        },
        outfits: outfits.map((o: any) => ({ ...o, colors: parseJson(o.colors, {}), items: parseJson(o.items, []) })),
        friends,
        follows,
        blocks,
        status_updates,
        notifications,
        applications,
        username_history,
        invite_log,
        moderation_history,
        security_audit,
        export_metadata: {
            exported_at: new Date().toISOString(),
            export_version: "1.0",
            user_id: userId
        }
    };
}

interface RectifyData {
    about?: string;
    social_discord?: string;
    social_twitter?: string;
    social_youtube?: string;
    theme?: string;
    social_visibility?: { discord?: boolean; twitter?: boolean; youtube?: boolean };
}

export const rectifyUserData = async (userId: number, data: RectifyData): Promise<string[]> => {
    const updates: string[] = [];
    const sets: string[] = [];
    const params: any[] = [];

    if (data.about !== undefined) {
        sets.push("about = ?");
        params.push(data.about);
        updates.push("about");
    }
    if (data.social_discord !== undefined) {
        sets.push("social_discord = ?");
        params.push(data.social_discord);
        updates.push("social_discord");
    }
    if (data.social_twitter !== undefined) {
        sets.push("social_twitter = ?");
        params.push(data.social_twitter);
        updates.push("social_twitter");
    }
    if (data.social_youtube !== undefined) {
        sets.push("social_youtube = ?");
        params.push(data.social_youtube);
        updates.push("social_youtube");
    }
    if (data.theme !== undefined) {
        sets.push("theme = ?");
        params.push(data.theme);
        updates.push("theme");
    }
    if (data.social_visibility !== undefined) {
        const [current] = await sql`SELECT social_visibility FROM users WHERE id = ${userId}`;
        const currentVis = parseJson(current?.social_visibility, { discord: true, twitter: true, youtube: true });
        const newVis = { ...currentVis, ...data.social_visibility };
        sets.push("social_visibility = ?::jsonb");
        params.push(JSON.stringify(newVis));
        updates.push("social_visibility");
    }

    if (sets.length > 0) {
        params.push(userId);
        await sql.unsafe(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
    }

    return updates;
}

export const restrictProcessing = async (userId: number, restrict: boolean): Promise<void> => {
    await sql`UPDATE users SET processing_restricted = ${restrict ? 1 : 0} WHERE id = ${userId}`;
};

export const withdrawConsent = async (userId: number, processingType: string, object: boolean): Promise<void> => {
    const [row] = await sql`SELECT processing_consents, processing_objections FROM users WHERE id = ${userId}`;
    const consents = parseJson<Record<string, boolean>>(row?.processing_consents, { marketing: false, analytics: true, profiling: false, third_party_sharing: false });
    const objections = parseJson<Record<string, boolean>>(row?.processing_objections, { marketing: false, analytics: false, profiling: false, third_party_sharing: false });

    if (object) {
        objections[processingType] = true;
        consents[processingType] = false;
    } else {
        objections[processingType] = false;
    }

    await sql`UPDATE users SET processing_consents = ${JSON.stringify(consents)}::jsonb, processing_objections = ${JSON.stringify(objections)}::jsonb WHERE id = ${userId}`;
}

export const getRetentionInfo = () => {
    return {
        policy_version: "1.1",
        last_updated: "2026-10-15",
        retention_periods: {
            account_data: {
                description: "Core account information (username, credentials, profile)",
                retention: "While your account is open, then deleted",
                legal_basis: "Contract (GDPR Art. 6(1)(b)) / PDPA Sec. 24"
            },
            uploaded_content: {
                description: "Games, assets, catalog items and media",
                retention: "While your account is open, then deleted",
                legal_basis: "Contract (GDPR Art. 6(1)(b))"
            },
            messages_chats: {
                description: "Private messages and chat history",
                retention: "Until you delete them or your account is deleted",
                legal_basis: "Contract (GDPR Art. 6(1)(b))"
            },
            moderation_records: {
                description: "Moderation actions and reports",
                retention: "Kept while needed for moderation, anonymised on account deletion",
                legal_basis: "Legitimate interest (GDPR Art. 6(1)(f))"
            },
            security_logs: {
                description: "Sign in, security events and IP addresses",
                retention: "Kept for a limited period, then deleted; anonymised on account deletion",
                legal_basis: "Legitimate interest (GDPR Art. 6(1)(f))"
            },
            admin_logs: {
                description: "Staff actions on the site",
                retention: "Kept for a limited period, then deleted",
                legal_basis: "Legitimate interest (GDPR Art. 6(1)(f))"
            },
            application_data: {
                description: "Team applications",
                retention: "About 90 days after a decision",
                legal_basis: "Consent (GDPR Art. 6(1)(a))"
            }
        },
        user_rights: {
            access: "Right to obtain copy of personal data (GDPR Art. 15, PDPA Sec. 30)",
            rectification: "Right to correct inaccurate data (GDPR Art. 16, PDPA Sec. 31)",
            erasure: "Right to be forgotten (GDPR Art. 17, PDPA Sec. 34)",
            restriction: "Right to restrict processing (GDPR Art. 18, PDPA Sec. 32)",
            portability: "Right to data portability (GDPR Art. 20, PDPA Sec. 30)",
            objection: "Right to object to processing (GDPR Art. 21, PDPA Sec. 33)",
            withdrawal: "Right to withdraw consent (GDPR Art. 7(3), PDPA Sec. 27)",
            complaint: "Right to lodge complaint with supervisory authority"
        },
        contact: {
            data_protection_officer: "privacy@nonerev.de",
            supervisory_authority: "Thailand PDPC (Personal Data Protection Committee)"
        }
    };
}