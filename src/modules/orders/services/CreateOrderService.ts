import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);
    if (!customerExists) {
      throw new AppError('Customer not found.');
    }

    const checkProducts = await this.productsRepository.findAllById(products);
    if (checkProducts.length < products.length) {
      throw new AppError('One or more products are not found.');
    }

    const checkQuantity = products.filter(
      product =>
        checkProducts.filter(prod => prod.id === product.id)[0].quantity <=
        product.quantity,
    );

    if (checkQuantity.length) {
      throw new AppError(
        'One or more products does not have the requested quantity',
      );
    }

    const productsOrder = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: checkProducts.filter(prod => prod.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: productsOrder,
    });

    const { order_products } = order;

    const orderedQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        checkProducts.filter(prod => prod.id === product.product_id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedQuantity);

    return order;
  }
}

export default CreateOrderService;
