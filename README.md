# data-graph-lib

This library provides a graph layer over different data sources. The data retrieval is handled by query resolver and field level resolvers.
Queries are can retrieve a graph over multiple data sources and pick required fields.

## Installation

```bash
# Using pnpm
pnpm add data-graph-lib

# Using yarn
yarn add data-graph-lib

# Using npm
npm install data-graph-lib
```

## Usage


```js
import { GraphQLService, QueryType } from "./lib";
import Zod from "zod";

const postComment = Zod.object({
        id: Zod.string(),
        text: Zod.string(),
        postId: Zod.string(),
    });

    const postType = Zod.object({
        id: Zod.string(),
        title: Zod.string(),
        comments: Zod.optional(Zod.array(postComment))
    });

    interface Schema {
        post: Zod.infer<typeof postType>;
        comment: Zod.infer<typeof postComment>;
    }

    const postData: Record<string, Zod.infer<typeof postType>> = {
        '1': {
            id: '1',
            title: 'Post 1',
        },
    };

    const commentData: Record<string, Zod.infer<typeof postComment>> = {
        '1': {
            id: '1',
            text: 'Comment 1',
            postId: '1',
        },
        '2': {
            id: '2',
            text: 'Comment 1',
            postId: '1',
        }
    };

    function resolvePost(args: { id: string }): Zod.infer<typeof postType> | null {
        return postData[args.id] || null;
    }

    function resolvePostComments(post: Zod.infer<typeof postType>): Zod.infer<typeof postComment>[] | null {
        return Object.values(commentData).filter(comment => comment.postId === post.id);
    }

    const service = new GraphQLService<Schema>();

    service.registerQuery('post', resolvePost)
    // @ts-ignore
    service.registerResolver('post', 'comments', 'comment',resolvePostComments);

    const query: QueryType<Schema> = {
        type: "post",
        args: { id: '1' },
        fields: {
            'id': true,
            'title': true,
            'comments': {
                type: 'comment',
                manipulate: (comments)=>comments.map(c=>c.text.toUpperCase()),
                fields: {
                    id: true,
                    text: true,
                },
            },
        },
    };

    const selectedPost = await service.executeQuery<'post'>(query);
    console.log('selectedPost',selectedPost);
    /*
    {
        __type: "post",
        comments: [
            {
                __type: "comment",
                id: "1",
                text: "Comment 1",
            }
        ],
        id: "1",
        title: "Post 1",
    }
    */
```

### Contribution

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are greatly appreciated.

1. Fork the Project
1. Create your Feature Branch (git checkout -b feature/AmazingFeature)
1. Commit your Changes (git commit -m 'Add some AmazingFeature')
1. Push to the Branch (git push origin feature/AmazingFeature)
1. Open a Pull Request


### License

Distributed under the "bsd-2-clause" License. See [LICENSE.txt](LICENSE.txt) for more information.
