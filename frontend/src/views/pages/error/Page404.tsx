import { Card } from 'primereact/card';

const NotFoundExceptionPage = () => {
  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <Card>
        <div className="clearfix">
          <h1 className="float-start display-3 me-4">404</h1>
          <h4 className="pt-3">Oops! You{"'"}re lost.</h4>
          <p className="text-body-secondary float-start">
            The page you are looking for was not found.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default NotFoundExceptionPage;
