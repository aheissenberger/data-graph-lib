import { expect, test } from "bun:test";
import { GraphQLService, QueryType } from "./lib";
import Zod from "zod";

test("query", async () => {


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
    service.registerResolver('post', 'comments', 'comment', resolvePostComments);

    const query: QueryType<Schema> = {
        type: "post",
        args: { id: '1' },
        fields: {
            'id': true,
            'title': true,
            'comments': {
                type: 'comment',
                fields: {
                    id: true,
                    text: true,
                },
            },
        },
    };

    const expected = {
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

    const selectedPost = await service.executeQuery<'post'>(query);
    console.log('selectedPost', selectedPost?.comments?.[0].text);
    // @ts-ignore
    expect(selectedPost).toEqual(expected);
})


test("query2", async () => {


    const postType = Zod.object({
        id: Zod.string(),
        title: Zod.string(),

    });

    const postsType = Zod.array(postType);

    interface Schema {
        post: Zod.infer<typeof postType>;
        posts: Zod.infer<typeof postsType>;
    }

    const postData: Record<string, Zod.infer<typeof postType>> = {
        '1': {
            id: '1',
            title: 'Post 1',
        },
        '2': {
            id: '2',
            title: 'Post 2',
        }
    };



    function resolvePost(args: { id: string }): Zod.infer<typeof postType> | null {
        return postData[args.id] || null;
    }

    function resolvePosts(): Zod.infer<typeof postType>[] | null {
        return Object.values(postData) || null;
    }

    const service = new GraphQLService<Schema>();

    service.registerQuery('post', resolvePost)
    service.registerQuery('posts', resolvePosts)

    const query: QueryType<Schema> = {
        type: "posts",
        manipulate: (posts: Zod.infer<typeof postsType>) => posts.filter(post => post.id === '1'),
        fields:
        {
            'title': true,
        }

    };

    const expected = [{
        __type: "posts",
        title: "Post 1"
    },
        // {
        //     __type: "posts",
        //     title: "Post 2"
        // }
    ]

    const selectedPost = await service.executeQuery<'posts'>(query);
    console.log('selectedPost', selectedPost);
    // @ts-ignore
    expect(selectedPost).toEqual(expected);
})  