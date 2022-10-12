import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { NodeHtmlMarkdown } from 'node-html-markdown';
import { map, Observable, switchMap } from 'rxjs';

import { items as rawSites} from './sites.json'; // Fetched from https://api.stackexchange.com/2.3/sites, rarely updated.

interface StackExchangeSite {
  name: string;
  siteUrl: string;
  slug: string;
  audience: string;
}

interface Question {
  id: string;
  title: string;
}

interface Answer {
  id: string;
  body: string;
}

const API_BASE_URL = 'https://api.stackexchange.com/2.2';

@Injectable()
export class StackExchangeService {

  readonly sites: ReadonlyArray<StackExchangeSite> = rawSites
      .filter(item => item.site_type === 'main_site')
      .map(item => ({
        name: item.name,
        siteUrl: item.site_url,
        slug: item.api_site_parameter,
        audience: item.audience
      }));

  constructor(private readonly http: HttpService) {}

  getSiteBySlug(slug: string): StackExchangeSite {
    const result = this.sites.find(site => site.slug === slug);
    if (!result) {
      throw new Error('Site not found!');
    }
    return result;
  }

  searchAnswer(q: string, siteSlug: string): Observable<string> {
    const site = this.getSiteBySlug(siteSlug);
    return this.searchRelevantQuestion(q, site).pipe(
      switchMap(question =>
        this.searchBestAnswer(question.id, site).pipe(
          map(answer => ({ question, answer })),
        )
      ),
      map(({ question, answer }) =>
        `Below is what I found on ${site.name}:` +
        '\n\n' +
        `## Q: ${question.title}` +
        '\n\n' +
        new NodeHtmlMarkdown().translate(`<blockquote>${answer.body}</blockquote>`) +
        '\n\n' +
        `Source: ${site.siteUrl}/a/${answer.id}`
      ),
      
    );
  }

  searchRelevantQuestion(q: string, site: StackExchangeSite): Observable<Question> {
    return this.http.get(
      `${API_BASE_URL}/search/advanced`,
      { params: { order: 'desc', sort: 'relevance', q, answers: 1, site: site.slug, filter: 'withbody' } }
    ).pipe(
      map(response => response.data['items'][0]),
      map(item => ({ id: item['question_id'], title: item['title'] }))
    );
  }

  searchBestAnswer(questionId: string, site: StackExchangeSite): Observable<Answer> {
    return this.http.get(
      `${API_BASE_URL}/questions/${questionId}/answers`,
      { params: { order: 'desc', sort: 'votes', site: site.slug, filter: 'withbody' } }
    ).pipe(
      map(response => response.data['items'][0]),
      map(item => ({ id: item['answer_id'], body: item['body'] })),
    );
  }
}
