'use strict';

const { createTestBuilder } = require('../../../test/helpers/builder');
const { createStrapiInstance } = require('../../../test/helpers/strapi');
const { createAuthRequest } = require('../../../test/helpers/request');
const modelsUtils = require('../../../test/helpers/models');

const builder = createTestBuilder();
let strapi;
let rq;
let data = {
  dogs: [],
};

const dogModel = {
  draftAndPublish: false,
  attributes: {
    name: {
      type: 'string',
      required: false,
    },
  },
  connection: 'default',
  name: 'dog',
  description: '',
  collectionName: '',
};

const dogs = [
  {
    name: null,
  },
  {
    name: 'Atos',
  },
];

const restart = async () => {
  await strapi.destroy();
  strapi = await createStrapiInstance({ ensureSuperAdmin: true });
  rq = await createAuthRequest({ strapi });
};

describe('Migration - required attribute', () => {
  beforeAll(async () => {
    await builder
      .addContentType(dogModel)
      .addFixtures(dogModel.name, dogs)
      .build();

    strapi = await createStrapiInstance({ ensureSuperAdmin: true });
    rq = await createAuthRequest({ strapi });

    data.dogs = builder.sanitizedFixturesFor(dogModel.name, strapi);
  }, 60000);

  afterAll(async () => {
    await strapi.destroy();
    await builder.cleanup();
  });

  describe('Required: false -> true', () => {
    test('Can be null before migration', async () => {
      let { body } = await rq({
        url: '/content-manager/explorer/application::dog.dog',
        method: 'GET',
      });
      expect(body.length).toBe(2);
      const dogWithNameNull = body.find(dog => dog.name === null);
      expect(dogWithNameNull).toBeTruthy();
    });

    test('Cannot create an entry with null after migration', async () => {
      // remove null values otherwise the migration would fail
      const { body } = await rq({
        url: `/content-manager/explorer/application::dog.dog/${data.dogs[0].id}`,
        method: 'PUT',
        body: { name: 'Nelson' },
      });
      data.dogs[0] = body;

      // migration
      const schema = await modelsUtils.getContentTypeSchema(dogModel.name, { strapi });
      schema.attributes.name.required = true;

      await modelsUtils.modifyContentType(schema, { strapi });
      await restart();

      // Try to create an entry with null
      const res = await rq({
        method: 'POST',
        url: '/content-manager/explorer/application::dog.dog',
        body: { name: null },
      });
      expect(res.body.message).toBe('ValidationError');
    });
  });

  describe('Required: true -> false', () => {
    test('Can create an entry with null after migration', async () => {
      // migration
      const schema = await modelsUtils.getContentTypeSchema(dogModel.name, { strapi });
      schema.attributes.name.required = false;

      await modelsUtils.modifyContentType(schema, { strapi });
      await restart();

      // Try to create an entry with null
      const res = await rq({
        url: `/content-manager/explorer/application::dog.dog`,
        method: 'POST',
        body: { name: null },
      });

      expect(res.body).toMatchObject({ name: null });
      data.dogs.push(res.body);
    });
  });
});
