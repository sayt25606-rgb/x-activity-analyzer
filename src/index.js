import { handleOg } from './og.js';
import { handleShare } from './share.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/og') {
      return handleOg(request, env);
    }
    if (url.pathname === '/share') {
      return handleShare(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
