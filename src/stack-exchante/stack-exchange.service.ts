import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { NodeHtmlMarkdown } from 'node-html-markdown';
import { map, Observable, switchMap } from 'rxjs';

// List of StackExchange sites fetched from https://api.stackexchange.com/2.3/sites, rarely updated.
import { items as rawSites} from './sites.json';

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

const formatAnswerBody = (htmlText: string): string => {
  let markdownText = new NodeHtmlMarkdown().translate(`<blockquote>${htmlText}</blockquote>`);
  const maxTextLength = 1024;
  if (markdownText.length > maxTextLength) {
    markdownText = markdownText.slice(0, maxTextLength - 4) + ' ...';
  }
  return markdownText;
}

const buildAnswerText = (site: StackExchangeSite, question: Question, answer: Answer): string =>
`Below is what I found on ${site.name}:

## Q: ${question.title}

${formatAnswerBody(answer.body)}

Source: ${site.siteUrl}/a/${answer.id}`;

@Injectable()
export class StackExchangeService {
  readonly apiKey: string;

  readonly sites: ReadonlyArray<StackExchangeSite> = rawSites
    .filter(item => item.site_type === 'main_site')
    .map(item => ({
      name: item.name,
      siteUrl: item.site_url,
      slug: item.api_site_parameter,
      audience: item.audience,
    }));

  constructor(private readonly http: HttpService, configService: ConfigService) {
    this.apiKey = configService.get<string>('STACKAPP_API_KEY');
  }

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
      switchMap(question => this.searchBestAnswer(question.id, site).pipe(map(answer => ({ question, answer })))),
      map(({ question, answer }) => buildAnswerText(site, question, answer)),
    );
  }

  searchRelevantQuestion(q: string, site: StackExchangeSite): Observable<Question> {
    return this.get(site, '/search/advanced', {
      order: 'desc',
      sort: 'relevance',
      q,
      answers: 1,
      filter: 'withbody',
    }).pipe(
      map(data => data['items'][0]),
      map(item => ({ id: item['question_id'], title: item['title'] })),
    );
  }

  searchBestAnswer(questionId: string, site: StackExchangeSite): Observable<Answer> {
    return this.get(site, `/questions/${questionId}/answers`, {
      order: 'desc',
      sort: 'votes',
      filter: 'withbody',
    }).pipe(
      map(data => data['items'][0]),
      map(item => ({ id: item['answer_id'], body: item['body'] })),
    );
  }

  private get(site: StackExchangeSite, uri: string, params?: Record<string, any>): Observable<any> {
    return this.http
      .get(`${API_BASE_URL}${uri}`, { params: { ...params, key: this.apiKey, site: site.slug } })
      .pipe(map(response => response.data));
  }
}
