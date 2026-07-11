package com.mekongsaltlab.org.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class DownloadTokenService {

    private final Map<String, TokenEntry> tokenStore = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    private static final long TOKEN_TTL_SECONDS = 300;

    public String createToken(String s3Key) {
        String token = UUID.randomUUID().toString();
        tokenStore.put(token, new TokenEntry(s3Key, System.currentTimeMillis()));
        scheduler.schedule(() -> tokenStore.remove(token), TOKEN_TTL_SECONDS, TimeUnit.SECONDS);
        return token;
    }

    public String resolveToken(String token) {
        TokenEntry entry = tokenStore.get(token);
        if (entry == null) return null;
        if (System.currentTimeMillis() - entry.createdAt > TOKEN_TTL_SECONDS * 1000) {
            tokenStore.remove(token);
            return null;
        }
        return entry.s3Key;
    }

    public void removeToken(String token) {
        tokenStore.remove(token);
    }

    private record TokenEntry(String s3Key, long createdAt) {}
}
